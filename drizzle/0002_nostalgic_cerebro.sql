CREATE TABLE `linkedin_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`member_sub` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`headline` text,
	`access_token` text NOT NULL,
	`expires_at` integer,
	`scopes` text NOT NULL,
	`connected_at` integer NOT NULL
);
