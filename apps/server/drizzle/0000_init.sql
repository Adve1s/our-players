CREATE TYPE "public"."ended_in" AS ENUM('REG', 'OT', 'SO');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('SCHEDULED', 'LIVE', 'FINAL', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('running', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."league" AS ENUM('NHL', 'NBA');--> statement-breakpoint
CREATE TYPE "public"."nationality_source" AS ENUM('birth', 'override');--> statement-breakpoint
CREATE TYPE "public"."position_group" AS ENUM('forward', 'defense', 'goalie', 'guard', 'center');--> statement-breakpoint
CREATE TYPE "public"."season_type" AS ENUM('PRE', 'REG', 'POST');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('nhl', 'espn');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('hockey', 'basketball');--> statement-breakpoint
CREATE TYPE "public"."stat_basis" AS ENUM('totals', 'per_game');--> statement-breakpoint
CREATE TYPE "public"."stat_kind" AS ENUM('hockey_skater', 'hockey_goalie', 'basketball_player');--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"league" "league" NOT NULL,
	"season" text NOT NULL,
	"season_type" "season_type" NOT NULL,
	"game_date" date NOT NULL,
	"start_time_utc" timestamp with time zone NOT NULL,
	"status" "game_status" NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"period_scores" jsonb,
	"ended_in" "ended_in",
	"final_at" timestamp with time zone,
	"boxscore_fetched_at" timestamp with time zone,
	"corrected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "games_source_external_id_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"job" text NOT NULL,
	"args" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "job_status" NOT NULL,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"code" "league" PRIMARY KEY NOT NULL,
	"sport" "sport" NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_external_ids" (
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "player_external_ids_source_external_id_pk" PRIMARY KEY("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"league" "league" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"search_name" text NOT NULL,
	"position" text NOT NULL,
	"position_group" "position_group" NOT NULL,
	"current_team_id" integer,
	"jersey" text,
	"birth_date" date,
	"birth_city" text,
	"birth_country" text,
	"nationality" text,
	"nationality_source" "nationality_source",
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "season_stats" (
	"player_id" integer NOT NULL,
	"season" text NOT NULL,
	"season_type" "season_type" NOT NULL,
	"kind" "stat_kind" NOT NULL,
	"basis" "stat_basis" NOT NULL,
	"stats" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_stats_player_id_season_season_type_kind_pk" PRIMARY KEY("player_id","season","season_type","kind")
);
--> statement-breakpoint
CREATE TABLE "stat_lines" (
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"kind" "stat_kind" NOT NULL,
	"played" boolean NOT NULL,
	"dnp_reason" text,
	"starter" boolean,
	"stats" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stat_lines_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"league" "league" NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"abbrev" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_source_external_id_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_league_leagues_code_fk" FOREIGN KEY ("league") REFERENCES "public"."leagues"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_external_ids" ADD CONSTRAINT "player_external_ids_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_league_leagues_code_fk" FOREIGN KEY ("league") REFERENCES "public"."leagues"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_current_team_id_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_lines" ADD CONSTRAINT "stat_lines_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_lines" ADD CONSTRAINT "stat_lines_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_lines" ADD CONSTRAINT "stat_lines_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_leagues_code_fk" FOREIGN KEY ("league") REFERENCES "public"."leagues"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_league_game_date_idx" ON "games" USING btree ("league","game_date");--> statement-breakpoint
CREATE INDEX "player_external_ids_player_id_idx" ON "player_external_ids" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "players_nationality_idx" ON "players" USING btree ("nationality");--> statement-breakpoint
CREATE INDEX "stat_lines_player_id_idx" ON "stat_lines" USING btree ("player_id");