import { submit } from "@/lib/server/routes/submissions";
import { serve } from "@/lib/server/serve";

export const POST = serve(submit);
