package com.kai.billingsharing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class BusinessTimeConfig {
    public static final String ZONE = "Asia/Ho_Chi_Minh";

    @Bean
    public Clock businessClock() {
        return Clock.system(ZoneId.of(ZONE));
    }
}
