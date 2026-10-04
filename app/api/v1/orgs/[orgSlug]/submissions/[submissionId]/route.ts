import { getOne } from "@/lib/server/routes/submissions";
import { serve } from "@/lib/server/serve";

export const GET = serve(getOne);
