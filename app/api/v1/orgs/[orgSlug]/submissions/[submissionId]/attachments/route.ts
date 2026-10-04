import { list } from "@/lib/server/routes/attachments";
import { serve } from "@/lib/server/serve";

export const GET = serve(list);
