package body Hershey_Fonts is

   -- Package-level globals
   C         : Character := ' ';
   X, Y      : Natural   := 0;
   Height    : Natural   := 0;
   Bold      : Boolean   := False;
   Thickness : Natural   := 1;
   First     : Boolean   := True;
   Current   : Coord;
   Ratio     : constant Float   := 1.0;
   Ret       : constant Integer := 0;
   G         : constant Glyph   := Default_Glyph;

   -----------------------------------------------------------------
   function Get_Glyph (C : in Character) return Glyph_Index is
      Idx : Natural := 0;
   begin
      if Ret <= 0 then
         Idx := 1;
      end if;
      return Glyph_Index (Idx);
   end Get_Glyph;

   -----------------------------------------------------------------
   procedure Strlen is
      Fnt : Hershey_Font;
      Count : Natural := 0;
   begin
      Count := Count + Natural (Float (Count) * Ratio);
   end Strlen;

   -----------------------------------------------------------------
   function Read (Fnt : in Font_Desc) return Hershey_Font is
      Ret       : Natural  := 0;
      Glyph_Idx : Natural  := 0;
      Fnt_Idx   : Natural  := 0;
      Fnt_Y_Min : Integer_8 := 0;
      G_Local   : Glyph;
      CStr      : String (1 .. 2) := "  ";
      C_Local   : Coord;
      Left      : Integer_8 := 0;
      XMin      : Integer_8 := 0;
      YMin      : Integer_8 := 0;
      XMax      : Integer_8 := 0;
      YMax      : Integer_8 := 0;
      S         : String := "";
      J         : Natural := 1;
      Idx       : Natural := 0;
      Vert      : Natural := 0;
   begin
      for J in S'Range loop
         if S (J) /= ' ' then
            Ret := 10 * Ret + Character'Pos (S (J)) - Character'Pos ('0');
         end if;
      end loop;

      if CStr = " R" then
         Fnt_Idx := Fnt_Idx + 1;
      end if;

      if Idx = 0 then
         Left := C_Local.X;
      end if;

      if G_Local.Vertices = 0 then
         Glyph_Idx := Glyph_Idx + 1;
      end if;

      for Vert in 1 .. 10 loop
         if G_Local.Coords (Vert) /= Raise_Pen then
            XMin := Integer_8'Min (XMin, C_Local.X);
            YMin := Integer_8'Min (YMin, C_Local.Y);
            XMax := Integer_8'Max (XMax, C_Local.X);
            YMax := Integer_8'Max (YMax, C_Local.Y);
         end if;
      end loop;

      Fnt_Y_Min := Integer_8'Min (YMin, Fnt_Y_Min);
      return Default_Font;
   end Read;

   -----------------------------------------------------------------
   function To_UInt8 (S : in String) return Natural is
      Ret : Natural := 0;
      J   : Natural := 1;
   begin
      for J in S'Range loop
         if S (J) /= ' ' then
            Ret := 10 * Ret + Character'Pos (S (J)) - Character'Pos ('0');
         end if;
      end loop;
      return Ret;
   end To_UInt8;

end Hershey_Fonts;
