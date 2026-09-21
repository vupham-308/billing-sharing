package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.AddMemberRequest;
import com.kai.billingsharing.dto.request.CreateGroupRequest;
import com.kai.billingsharing.dto.response.GroupDetailResponse;
import com.kai.billingsharing.dto.response.GroupMemberResponse;
import com.kai.billingsharing.dto.response.GroupResponse;
import com.kai.billingsharing.entity.Group;
import com.kai.billingsharing.entity.GroupMember;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.GroupRepository;
import com.kai.billingsharing.repository.UserRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private GroupService groupService;

    private User adminUser;
    private User normalUser;
    private CustomUserDetails adminUserDetails;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(UUID.randomUUID())
                .email("admin@example.com")
                .fullName("Admin User")
                .role(Role.ADMIN)
                .balance(0L)
                .build();
        adminUserDetails = new CustomUserDetails(adminUser);

        normalUser = User.builder()
                .id(UUID.randomUUID())
                .email("member@example.com")
                .fullName("Normal Member")
                .role(Role.USER)
                .balance(0L)
                .build();
    }

    @Test
    void testCreateGroup_Success() {
        CreateGroupRequest request = CreateGroupRequest.builder()
                .name("Nhóm Du Lịch")
                .summaryDayOfMonth(List.of(25))
                .build();

        Group savedGroup = Group.builder()
                .id(UUID.randomUUID())
                .name("Nhóm Du Lịch")
                .summaryDayOfMonth(List.of(25))
                .createdBy(adminUser)
                .build();

        when(groupRepository.save(any(Group.class))).thenReturn(savedGroup);
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(i -> i.getArgument(0));

        GroupResponse response = groupService.createGroup(request, adminUserDetails);

        assertNotNull(response);
        assertEquals("Nhóm Du Lịch", response.getName());
        assertEquals(List.of(25), response.getSummaryDayOfMonth());
        assertEquals(adminUser.getId(), response.getCreatedById());
        assertEquals(0L, response.getMyBalanceInGroup());

        verify(groupRepository, times(1)).save(any(Group.class));
        verify(groupMemberRepository, times(1)).save(any(GroupMember.class));
    }

    @Test
    void testAddMember_Success() {
        UUID groupId = UUID.randomUUID();
        Group group = Group.builder()
                .id(groupId)
                .name("Nhóm Bạn Thân")
                .createdBy(adminUser)
                .build();

        AddMemberRequest request = AddMemberRequest.builder()
                .email("member@example.com")
                .build();

        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(normalUser));
        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, normalUser.getId())).thenReturn(false);
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(i -> {
            GroupMember gm = i.getArgument(0);
            gm.setId(UUID.randomUUID());
            return gm;
        });

        GroupMemberResponse response = groupService.addMember(groupId, request, adminUserDetails);

        assertNotNull(response);
        assertEquals(normalUser.getId(), response.getUserId());
        assertEquals("member@example.com", response.getEmail());
        assertEquals(0L, response.getBalance());
        verify(groupMemberRepository, times(1)).save(any(GroupMember.class));
    }

    @Test
    void testAddMember_DuplicateMember_ThrowsConflict() {
        UUID groupId = UUID.randomUUID();
        Group group = Group.builder()
                .id(groupId)
                .name("Nhóm Bạn Thân")
                .createdBy(adminUser)
                .build();

        AddMemberRequest request = AddMemberRequest.builder()
                .email("member@example.com")
                .build();

        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(normalUser));
        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, normalUser.getId())).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> groupService.addMember(groupId, request, adminUserDetails));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("đã là thành viên"));
    }
}
