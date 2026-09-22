package com.kai.billingsharing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BillingSharingApplication {

    public static void main(String[] args) {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(
                com.kai.billingsharing.config.BusinessTimeConfig.ZONE));
        SpringApplication.run(BillingSharingApplication.class, args);
    }

}
