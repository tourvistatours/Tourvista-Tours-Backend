/*
  Warnings:

  - You are about to drop the column `endDate` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `guests` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `arrivalDate` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numberOfTravellers` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('FULL', 'ADVANCE');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "endDate",
DROP COLUMN "guests",
DROP COLUMN "startDate",
ADD COLUMN     "arrivalDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "numberOfTravellers" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "type" "PaymentType" NOT NULL;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "maxGuests" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "minGuests" INTEGER NOT NULL DEFAULT 1;
