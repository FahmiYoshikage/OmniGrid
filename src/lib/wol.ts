import { z } from "zod";

const EMPTY_TO_NULL = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export const MacAddressSchema = z.preprocess(
  EMPTY_TO_NULL,
  z
    .string()
    .trim()
    .regex(/^(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/, "Enter a valid MAC address")
    .transform((value) => value.replace(/-/g, ":").toUpperCase())
    .nullable()
    .optional(),
);

export const WolBroadcastSchema = z.preprocess(
  EMPTY_TO_NULL,
  z
    .string()
    .trim()
    .refine((value) => {
      const octets = value.split(".");
      return (
        octets.length === 4 &&
        octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255) &&
        value !== "0.0.0.0" &&
        octets[3] === "255"
      );
    }, "Enter an IPv4 broadcast address ending in .255")
    .nullable()
    .optional(),
);
