import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MdError } from "react-icons/md";
import { useFormContext } from "react-hook-form";

interface QuantityProps {
  onRestock: () => void;
}

export default function Quantity({ onRestock }: QuantityProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  return (
    <div className=" flex flex-col gap-2 pt-[6px]">
      <Label htmlFor="quantity" className="text-slate-600">
        {`Stok`}
      </Label>
      <Input
        {...register("quantity", { valueAsNumber: true })}
        type="text"
        id="quantity"
        className="h-11 shadow-none"
        placeholder="34"
      />
      <Button type="button" variant="secondary" onClick={onRestock}>
        Restock +5.000
      </Button>
      {errors.quantity && (
        <div className="text-red-500 flex gap-1 items-center text-[13px]">
          <MdError />
          <p>
            <>{errors.quantity.message}</>
          </p>
        </div>
      )}
    </div>
  );
}
