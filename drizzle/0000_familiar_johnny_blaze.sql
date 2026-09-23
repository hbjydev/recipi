CREATE TABLE IF NOT EXISTS "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"servings" text DEFAULT '' NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"notes" text DEFAULT '' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "api_tokens_permission_check" CHECK ("api_tokens"."permission" IN ('read', 'write'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredients" (
	"recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "ingredients_recipe_id_position_pk" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_shares" (
	"recipe_id" uuid PRIMARY KEY NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"share_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_shares_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "steps" (
	"recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "steps_recipe_id_position_pk" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"tag" text NOT NULL,
	CONSTRAINT "tags_recipe_id_tag_pk" PRIMARY KEY("recipe_id","tag")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_owner_created" ON "api_tokens" USING btree ("household_id","user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipes_owner_updated" ON "recipes" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_tag" ON "tags" USING btree (lower("tag"));