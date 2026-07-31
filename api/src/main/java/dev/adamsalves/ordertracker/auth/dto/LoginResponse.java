package dev.adamsalves.ordertracker.auth.dto;

public record LoginResponse(String token, long expiresIn) {}
