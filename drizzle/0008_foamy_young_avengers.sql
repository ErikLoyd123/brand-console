ALTER TABLE `sources` ADD `keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `default_tag` text DEFAULT 'needs-your-take' NOT NULL;