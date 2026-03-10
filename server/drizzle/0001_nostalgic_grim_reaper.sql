ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `auth_provider` enum('LOCAL','MICROSOFT') DEFAULT 'LOCAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `provider_subject` varchar(191);--> statement-breakpoint
ALTER TABLE `users` ADD `tenant_id` varchar(191);--> statement-breakpoint
ALTER TABLE `users` ADD `approval_status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `requested_department_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `users` ADD `approved_by_user_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `users` ADD `approved_at` datetime(3);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_provider_subject_idx` UNIQUE(`auth_provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `users_requested_dept_idx` ON `users` (`requested_department_id`);--> statement-breakpoint
CREATE INDEX `users_approval_status_idx` ON `users` (`approval_status`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_requested_department_id_departments_id_fk` FOREIGN KEY (`requested_department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_approved_by_user_id_users_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
