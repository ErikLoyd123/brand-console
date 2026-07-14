CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`kind` text DEFAULT 'personal' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_slug_uniq` ON `profiles` (`slug`);--> statement-breakpoint
DROP INDEX `tags_slug_uniq`;--> statement-breakpoint
ALTER TABLE `tags` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_uniq` ON `tags` (`profile_id`,`slug`);--> statement-breakpoint
ALTER TABLE `drafts` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `feed_items` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
CREATE INDEX `feed_items_profile_id_idx` ON `feed_items` (`profile_id`);--> statement-breakpoint
ALTER TABLE `idea_queue_items` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
CREATE INDEX `idea_queue_items_profile_id_idx` ON `idea_queue_items` (`profile_id`);--> statement-breakpoint
ALTER TABLE `linkedin_tokens` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `sources` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `sparks` ADD `profile_id` text DEFAULT 'default' NOT NULL REFERENCES profiles(id);