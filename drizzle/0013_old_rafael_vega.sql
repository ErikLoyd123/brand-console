CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text DEFAULT 'default' NOT NULL,
	`idea_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`slug` text,
	`target_keyword` text DEFAULT '' NOT NULL,
	`search_intent` text DEFAULT '' NOT NULL,
	`meta_description` text DEFAULT '' NOT NULL,
	`length_target` integer DEFAULT 0 NOT NULL,
	`sections` text NOT NULL,
	`stage` text DEFAULT 'outlining' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`export_path` text,
	`exported_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`idea_id`) REFERENCES `idea_queue_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_profile_slug_uniq` ON `articles` (`profile_id`,`slug`);--> statement-breakpoint
CREATE INDEX `articles_profile_id_idx` ON `articles` (`profile_id`);--> statement-breakpoint
CREATE INDEX `articles_idea_id_idx` ON `articles` (`idea_id`);