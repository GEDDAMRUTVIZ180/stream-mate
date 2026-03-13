import * as z from 'zod';

export const formSchema = z.object({
  username: z.string(),
  roomId: z.coerce.number(),
});
