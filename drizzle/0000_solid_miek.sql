CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`guest_name` text NOT NULL,
	`guest_avatar` text NOT NULL,
	`property_name` text NOT NULL,
	`city` text NOT NULL,
	`channel_source` text NOT NULL,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`response` text
);
