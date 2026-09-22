package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.AddMemberRequest;
import com.kai.billingsharing.dto.request.CreateGroupRequest;
import com.kai.billingsharing.dto.response.GroupDetailResponse;
import com.kai.billingsharing.dto.response.GroupMemberResponse;
import com.kai.billingsharing.dto.response.GroupResponse;
import com.kai.billingsharing.dto.response.UserResponse;
import com.kai.billingsharing.entity.Group;
import com.kai.billingsharing.entity.GroupMember;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.GroupRepository;
import com.kai.billingsharing.repository.UserRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public GroupResponse createGroup(CreateGroupRequest request, CustomUserDetails currentUser) {
        User creator = currentUser.getUser();

        if (request.getSummaryDayOfMonth() != null && !request.getSummaryDayOfMonth().isEmpty()) {
            boolean hasInvalidDay = request.getSummaryDayOfMonth().stream()
                    .anyMatch(d -> d == null || d < 1 || d > 27);
            if (hasInvalidDay) {
                throw new AppException("Ngày chốt sao kê chỉ hợp lệ từ ngày 1 đến ngày 27", HttpStatus.BAD_REQUEST);
            }
        }

        List<Integer> summaryDays = (request.getSummaryDayOfMonth() != null && !request.getSummaryDayOfMonth().isEmpty())
                ? request.getSummaryDayOfMonth().stream()
                        .distinct()
                        .sorted()
                        .toList()
                : List.of(25);

        Group group = Group.builder()
                .name(request.getName().trim())
                .summaryDayOfMonth(summaryDays)
                .createdBy(creator)
                .build();

        Group savedGroup = groupRepository.save(group);

        // Tự động thêm người tạo nhóm làm thành viên đầu tiên
        GroupMember creatorMember = GroupMember.builder()
                .group(savedGroup)
                .user(creator)
                .balance(0L)
                .build();
        groupMemberRepository.save(creatorMember);

        return GroupResponse.builder()
                .id(savedGroup.getId())
                .name(savedGroup.getName())
                .summaryDayOfMonth(savedGroup.getSummaryDayOfMonth())
                .createdById(creator.getId())
                .createdByName(creator.getFullName())
                .myBalanceInGroup(0L)
                .memberCount(1L)
                .createdAt(savedGroup.getCreatedAt())
                .build();
    }

    @Transactional
    public GroupMemberResponse addMember(UUID groupId, AddMemberRequest request, CustomUserDetails currentUser) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new AppException("Nhóm không tồn tại", HttpStatus.NOT_FOUND));

        // Kiểm tra quyền: Chỉ người tạo nhóm hoặc Admin mới có quyền thêm thành viên
        boolean isCreator = group.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getUser().getRole() == Role.ADMIN;
        if (!isCreator && !isAdmin) {
            throw new AppException("Chỉ người tạo nhóm hoặc Admin mới có quyền thêm thành viên", HttpStatus.FORBIDDEN);
        }

        String targetEmail = request.getEmail().trim().toLowerCase();
        User targetUser = userRepository.findByEmail(targetEmail)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng với email: " + targetEmail, HttpStatus.NOT_FOUND));

        if (groupMemberRepository.existsByGroupIdAndUserId(groupId, targetUser.getId())) {
            throw new AppException("Người dùng này đã là thành viên trong nhóm", HttpStatus.CONFLICT);
        }

        GroupMember newMember = GroupMember.builder()
                .group(group)
                .user(targetUser)
                .balance(0L)
                .build();

        GroupMember savedMember = groupMemberRepository.save(newMember);

        return GroupMemberResponse.builder()
                .id(savedMember.getId())
                .userId(targetUser.getId())
                .email(targetUser.getEmail())
                .fullName(targetUser.getFullName())
                .balance(savedMember.getBalance())
                .joinedAt(savedMember.getJoinedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> getMyGroups(CustomUserDetails currentUser) {
        List<GroupMember> myMemberships = groupMemberRepository.findByUserId(currentUser.getId());

        return myMemberships.stream().map(membership -> {
            Group group = membership.getGroup();
            return GroupResponse.builder()
                    .id(group.getId())
                    .name(group.getName())
                    .summaryDayOfMonth(group.getSummaryDayOfMonth())
                    .createdById(group.getCreatedBy().getId())
                    .createdByName(group.getCreatedBy().getFullName())
                    .myBalanceInGroup(membership.getBalance())
                    .memberCount(groupMemberRepository.countByGroupId(group.getId()))
                    .createdAt(group.getCreatedAt())
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GroupDetailResponse getGroupDetail(UUID groupId, CustomUserDetails currentUser) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new AppException("Nhóm không tồn tại", HttpStatus.NOT_FOUND));

        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUser.getId());
        boolean isAdmin = currentUser.getUser().getRole() == Role.ADMIN;
        if (!isMember && !isAdmin) {
            throw new AppException("Bạn không có quyền truy cập thông tin nhóm này", HttpStatus.FORBIDDEN);
        }

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        List<GroupMemberResponse> memberResponses = members.stream().map(m -> GroupMemberResponse.builder()
                .id(m.getId())
                .userId(m.getUser().getId())
                .email(m.getUser().getEmail())
                .fullName(m.getUser().getFullName())
                .balance(m.getBalance())
                .joinedAt(m.getJoinedAt())
                .build()
        ).collect(Collectors.toList());

        User creator = group.getCreatedBy();
        UserResponse creatorResponse = UserResponse.builder()
                .id(creator.getId())
                .email(creator.getEmail())
                .fullName(creator.getFullName())
                .role(creator.getRole())
                .balance(creator.getBalance())
                .build();

        return GroupDetailResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .summaryDayOfMonth(group.getSummaryDayOfMonth())
                .createdBy(creatorResponse)
                .members(memberResponses)
                .createdAt(group.getCreatedAt())
                .build();
    }
}
