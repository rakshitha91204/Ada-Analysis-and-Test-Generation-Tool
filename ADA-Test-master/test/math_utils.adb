package body Math_Utils is

   function Add (A : Integer; B : Integer) return Integer is
   begin
      return A + B;
   end Add;

   function Factorial (N : Integer) return Integer is
   begin
      if N <= 1 then
         return 1;
      else
         return N * Factorial(N - 1); -- recursion
      end if;
   end Factorial;

end Math_Utils;