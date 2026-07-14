CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text DEFAULT 'default' NOT NULL,
	`idea_id` text NOT NULL,
	`source` text NOT NULL,
	`path` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`params` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`idea_id`) REFERENCES `idea_queue_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `images_idea_id_idx` ON `images` (`idea_id`);--> statement-breakpoint
CREATE INDEX `images_profile_id_idx` ON `images` (`profile_id`);