import { grade } from "@/lib/server/routes/grades";
import { serve } from "@/lib/server/serve";

export const PUT = serve(grade);
