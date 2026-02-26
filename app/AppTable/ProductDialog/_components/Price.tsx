"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MdError } from "react-icons/md";
import { NumericFormat } from "react-number-format";
import { useFormContext, Controller } from "react-hook-form";

interface PriceProps {
  fieldName: "buyPrice" | "sellPrice";
  label: string;
  placeholder: string;
}

export default function Price({ fieldName, label, placeholder }: PriceProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const fieldError = errors[fieldName];

  return (
    <div className="flex flex-col gap-2 pt-[6px]">
      <Label htmlFor={fieldName} className="text-slate-600">
        {label}
      </Label>
      <Controller
        name={fieldName}
        control={control}
        defaultValue=""
        render={({ field: { onChange, value, ...field } }) => (
          <NumericFormat
            {...field}
            value={value}
            customInput={Input}
            thousandSeparator
            id={fieldName}
            placeholder={placeholder}
            className="h-11"
            decimalScale={2}
            allowNegative={false}
            onValueChange={(values) => {
              const { floatValue, value } = values;
              // If the input is empty (value is empty string), pass empty string
              // Otherwise pass the float value
              onChange(value === "" ? "" : floatValue ?? 0);
            }}
          />
        )}
      />

      {fieldError && (
        <div className="text-red-500 flex gap-1 items-center text-[13px]">
          <MdError />
          <p>{String(fieldError.message)}</p>
        </div>
      )}
    </div>
  );
}
