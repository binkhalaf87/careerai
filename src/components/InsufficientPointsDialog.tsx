import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  ar?: boolean;
}

export function InsufficientPointsDialog({ open, onClose, ar = false }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Coins className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>{ar ? "رصيدك لا يكفي" : "Insufficient Points"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "تحتاج إلى نقاط إضافية للمتابعة. اشترِ باقة نقاط للاستمرار."
              : "You need more points to continue. Purchase a points package to proceed."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => {
              onClose();
              navigate("/pricing");
            }}
          >
            <Coins className="mr-2 h-4 w-4" />
            {ar ? "شراء نقاط" : "Buy Points"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
