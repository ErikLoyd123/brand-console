ALTER TABLE `published_posts` ADD `platform` text DEFAULT 'linkedin' NOT NULL;--> statement-breakpoint
ALTER TABLE `published_posts` ADD `destination` text;--> statement-breakpoint
ALTER TABLE `published_posts` ADD `platform_post_id` text;