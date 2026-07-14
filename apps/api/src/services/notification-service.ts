import { prisma, type NotificationType } from "@soc/database";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({ data: input });
}
