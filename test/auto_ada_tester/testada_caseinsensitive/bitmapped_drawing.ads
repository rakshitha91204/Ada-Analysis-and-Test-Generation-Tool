with HAL; use HAL;

package Bitmapped_Drawing is

   -- ==============================================================
   -- GLOBAL VARIABLES — same logical type, different casing
   -- This is where the case-insensitive bug hits in Python:
   -- the analyzer looks up "UINT16" but the type_defs dict has
   -- only "uint16" or "UInt16" as key → miss → returns "Unknown"
   -- ==============================================================

   --  ① UInt16 written three ways (global scope)
   --    Python bug: type_defs["UINT16"] → KeyError (stored as "uint16")
   Orida        : UINT16  := 0;      -- [GLOBAL] ALL CAPS    ← case-bug A
   Aran         : uint16  := 0;      -- [GLOBAL] all lower   ← case-bug B
   Karan        : UInt16  := 0;      -- [GLOBAL] original    ← baseline

   --  ② Natural written three ways (global scope)
   --    Python bug: type_defs["NATURAL"] → KeyError
   Grid_Row     : NATURAL := 0;      -- [GLOBAL] ALL CAPS    ← case-bug C
   Grid_Col     : natural := 0;      -- [GLOBAL] all lower   ← case-bug D
   Grid_Depth   : Natural := 0;      -- [GLOBAL] original    ← baseline

   --  ③ Boolean written three ways (global scope)
   --    Python bug: type_defs["BOOLEAN"] → KeyError
   Flag_Top     : BOOLEAN := False;  -- [GLOBAL] ALL CAPS    ← case-bug E
   Flag_Mid     : boolean := False;  -- [GLOBAL] all lower   ← case-bug F
   Flag_Bot     : Boolean := False;  -- [GLOBAL] original    ← baseline

   --  ④ Integer written three ways (global scope)
   Pos_X        : INTEGER := 0;      -- [GLOBAL] ALL CAPS    ← case-bug G
   Pos_Y        : integer := 0;      -- [GLOBAL] all lower   ← case-bug H
   Pos_Z        : Integer := 0;      -- [GLOBAL] original    ← baseline

   --  ⑤ Float written three ways (global scope)
   Ratio_A      : FLOAT   := 0.0;   -- [GLOBAL] ALL CAPS    ← case-bug I
   Ratio_B      : float   := 0.0;   -- [GLOBAL] all lower   ← case-bug J
   Ratio_C      : Float   := 0.0;   -- [GLOBAL] original    ← baseline

   --  ⑥ Constants — same type, mixed casing
   Max_Orida    : constant UINT16  := 255;  -- [GLOBAL CONST] ALL CAPS  ← case-bug K
   Min_Aran     : constant uint16  := 0;    -- [GLOBAL CONST] all lower ← case-bug L
   Def_Karan    : constant UInt16  := 128;  -- [GLOBAL CONST] original  ← baseline

   -- ==============================================================
   -- Procedure declarations
   -- ==============================================================

   procedure Check_Pixel
     (Orida_In  : in  UINT16;    -- param type ALL CAPS  ← case-bug M
      Aran_In   : in  uint16;    -- param type all lower ← case-bug N
      Karan_Out : out UInt16);   -- param type original  ← baseline

   procedure Update_Grid
     (Row    : in  NATURAL;      -- param type ALL CAPS  ← case-bug O
      Col    : in  natural;      -- param type all lower ← case-bug P
      Result : out Natural);     -- param type original  ← baseline

   procedure Draw_Char
     (Buffer     : in out Bitmap_Buffer'Class;
      Start      : Point;
      Char       : Character;
      Font       : BMP_Font;
      Foreground : UInt32;
      Background : UInt32);

   procedure Draw_String
     (Buffer     : in out Bitmap_Buffer'Class;
      Start      : Point;
      Msg        : String;
      Font       : BMP_Font;
      Foreground : Bitmap_Color;
      Background : Bitmap_Color);

end Bitmapped_Drawing;
