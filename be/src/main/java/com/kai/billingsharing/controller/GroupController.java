package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.request.AddMemberRequest;
import com.kai.billingsharing.dto.request.CreateGroupRequest;
import com.kai.billingsharing.dto.response.GroupDetailResponse;
import com.kai.billingsharing.dto.response.GroupMemberResponse;
import com.kai.billingsharing.dto.response.GroupResponse;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @Valid @RequestBody CreateGroupRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        GroupResponse response = groupService.createGroup(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{groupId}/members")
    public ResponseEntity<GroupMemberResponse> addMember(
            @PathVariable UUID groupId,
            @Valid @RequestBody AddMemberRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        GroupMemberResponse response = groupService.addMember(groupId, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<GroupResponse>> getMyGroups(
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<GroupResponse> response = groupService.getMyGroups(currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<GroupDetailResponse> getGroupDetail(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        GroupDetailResponse response = groupService.getGroupDetail(groupId, currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<GroupMemberResponse>> getGroupMembers(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        GroupDetailResponse response = groupService.getGroupDetail(groupId, currentUser);
        return ResponseEntity.ok(response.getMembers());
    }
}
