TRUNCATE TABLE "agent_items", "agent_turns", "agent_threads" CASCADE;--> statement-breakpoint
DROP INDEX "idx_agent_threads_tenant";--> statement-breakpoint
ALTER TABLE "agent_threads" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING tenant_id::uuid;--> statement-breakpoint
ALTER TABLE "agent_items" ADD COLUMN "thread_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_items" ADD CONSTRAINT "agent_items_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_items_thread_created" ON "agent_items" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_agent_threads_id_tenant" ON "agent_threads" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_agent_threads_tenant_updated" ON "agent_threads" USING btree ("tenant_id","updated_at");