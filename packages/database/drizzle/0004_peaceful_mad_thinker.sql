ALTER TABLE "agent_items" DROP CONSTRAINT "agent_items_turn_id_agent_turns_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "turn_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_agent_turns_thread_turn_index" ON "agent_turns" USING btree ("thread_id","turn_index");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_agent_turns_id_thread" ON "agent_turns" USING btree ("id","thread_id");--> statement-breakpoint
ALTER TABLE "agent_items" ADD CONSTRAINT "agent_items_turn_id_thread_id_agent_turns_id_thread_id_fk" FOREIGN KEY ("turn_id","thread_id") REFERENCES "public"."agent_turns"("id","thread_id") ON DELETE cascade ON UPDATE no action;