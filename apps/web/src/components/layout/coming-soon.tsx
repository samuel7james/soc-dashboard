import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-12 text-center text-sm">
        {feature} ships in a later phase of the platform build-out (see TASKS.md).
      </CardContent>
    </Card>
  );
}
