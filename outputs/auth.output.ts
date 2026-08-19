import { z } from 'zod';
import { UserSchema } from '../generated/zod/modelSchema/UserSchema';

export const AuthUserOutputSchema = UserSchema.omit({ password: true }).extend({
  isAdmin: z.boolean(),
});

export type AuthUserOutput = z.infer<typeof AuthUserOutputSchema>;