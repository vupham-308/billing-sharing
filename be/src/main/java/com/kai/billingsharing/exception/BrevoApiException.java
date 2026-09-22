package com.kai.billingsharing.exception;

import lombok.Getter;

@Getter
public class BrevoApiException extends RuntimeException {
    private final int statusCode;
    private final String responseBody;

    public BrevoApiException(int statusCode, String responseBody) {
        super("Brevo API trả về lỗi HTTP " + statusCode + ": " + responseBody);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}
