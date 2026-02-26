import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MdError } from "react-icons/md";
import { useFormContext } from "react-hook-form";

export default function Unit() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-2 pt-[6px]">
      <Label htmlFor="unit" className="text-slate-600">
        Satuan
      </Label>
      <Input
        {...register("unit")}
        id="unit"
        className="h-11 shadow-none"
        placeholder="pcs / box / kg"
      />
      {errors.unit && (
        <div className="text-red-500 flex gap-1 items-center text-[13px]">
          <MdError />
          <p>{String(errors.unit.message)}</p>
        </div>
      )}
    </div>
  );
}
