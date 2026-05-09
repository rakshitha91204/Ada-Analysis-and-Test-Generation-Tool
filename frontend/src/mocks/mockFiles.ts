import { AdaFile } from '../types/file.types';

export const mockFiles: AdaFile[] = [
  {
    id: 'file_calculator_ads',
    name: 'calculator.ads',
    type: 'spec',
    status: 'parsed',
    uploadedAt: new Date().toISOString(),
    content: `-- Calculator Package Specification
-- Provides basic arithmetic operations

package Calculator is

   -- Adds two integers and stores result in Result
   procedure Add (X : in Integer; Y : in Integer; Result : out Integer);

   -- Subtracts Y from X and stores result in Result
   procedure Subtract (X : in Integer; Y : in Integer; Result : out Integer);

   -- Multiplies two integers and returns the product
   function Multiply (X : in Integer; Y : in Integer) return Integer;

   -- Divides X by Y and returns the quotient as Float
   -- Raises Constraint_Error if Y = 0
   function Divide (X : in Integer; Y : in Integer) return Float;

end Calculator;
`,
  },
  {
    id: 'file_calculator_adb',
    name: 'calculator.adb',
    type: 'body',
    status: 'parsed',
    uploadedAt: new Date().toISOString(),
    content: `-- Calculator Package Body
-- Implementation of basic arithmetic operations

package body Calculator is

   procedure Add (X : in Integer; Y : in Integer; Result : out Integer) is
   begin
      Result := X + Y;
   end Add;

   procedure Subtract (X : in Integer; Y : in Integer; Result : out Integer) is
   begin
      Result := X - Y;
   end Subtract;

   function Multiply (X : in Integer; Y : in Integer) return Integer is
      Product : Integer;
   begin
      Product := X * Y;
      return Product;
   end Multiply;

   function Divide (X : in Integer; Y : in Integer) return Float is
      Quotient : Float;
   begin
      if Y = 0 then
         raise Constraint_Error with "Division by zero";
      end if;
      Quotient := Float (X) / Float (Y);
      return Quotient;
   end Divide;

end Calculator;
`,
  },
];
