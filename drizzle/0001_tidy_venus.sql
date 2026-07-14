CREATE TABLE `feed_item_tags` (
	`feed_item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feed_item_id`) REFERENCES `feed_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_item_tags_uniq` ON `feed_item_tags` (`feed_item_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `feed_item_tags_tag_id_idx` ON `feed_item_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_uniq` ON `tags` (`slug`);--> statement-breakpoint
ALTER TABLE `feed_items` ADD `triage_state` text DEFAULT 'inbox' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_items` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `feed_items` ADD `promoted_idea_id` text;--> statement-breakpoint
ALTER TABLE `feed_items` ADD `score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `feed_items_triage_state_idx` ON `feed_items` (`triage_state`);--> statement-breakpoint
CREATE INDEX `feed_items_source_id_idx` ON `feed_items` (`source_id`);--> statement-breakpoint
CREATE INDEX `feed_items_published_at_idx` ON `feed_items` (`published_at`);