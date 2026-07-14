CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`hook_options` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`close` text DEFAULT '' NOT NULL,
	`media_suggestion` text DEFAULT '' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `idea_queue_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feed_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`summary` text,
	`published_at` integer,
	`raw` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `idea_queue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pillar` text NOT NULL,
	`tag` text NOT NULL,
	`source_ref` text,
	`proposed_angle` text NOT NULL,
	`seed` text,
	`score` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `published_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`permalink` text,
	`metrics` text NOT NULL,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`planned_for` integer,
	`status` text DEFAULT 'queued' NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`pillar` text,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sparks` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
