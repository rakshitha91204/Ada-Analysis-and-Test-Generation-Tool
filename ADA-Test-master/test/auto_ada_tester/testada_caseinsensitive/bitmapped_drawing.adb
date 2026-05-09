package body Bitmapped_Drawing is

   -- ================================================================
   --  LEGEND FOR CASE-INSENSITIVE BUG LOCATIONS:
   --
   --  [LOCAL-DECL]   variable declared locally with a mixed-case type
   --                 → Python bug: get_structured_type returns the raw
   --                   text e.g. "UINT16", then resolve_type_name does
   --                   dict lookup — fails if key stored as "uint16"
   --
   --  [IF-COND]      variable used inside an if-condition
   --                 → Python bug: findall(lal.Expr) finds the name node,
   --                   calls p_type or name lookup — case mismatch → Unknown
   --
   --  [ASSIGN]       variable on left/right side of :=
   --                 → same Expr walk issue
   --
   --  [GLOBAL-REF]   references a global from .ads with flipped casing
   --                 → Python bug: name.lower() lookup fixed this, but
   --                   without the fix global_vars["ORIDA"] → KeyError
   --                   when stored as "orida"
   -- ================================================================


   -- ----------------------------------------------------------------
   --  Check_Pixel
   --  Pattern:  if (NATURAL.Orida := Orida.Aran)
   --  Meaning:  local vars typed UINT16/uint16/UInt16 used in if/assign
   -- ----------------------------------------------------------------
   procedure Check_Pixel
     (Orida_In  : in  UINT16;
      Aran_In   : in  uint16;
      Karan_Out : out UInt16)
   is
      --  [LOCAL-DECL] three locals, same type UInt16, three casings
      Local_Orida  : UINT16 := 0;    -- ALL CAPS type  ← case-bug #1
      Local_Aran   : uint16 := 0;    -- lowercase type ← case-bug #2
      Local_Karan  : UInt16 := 0;    -- original type  ← baseline

      --  [LOCAL-DECL] Natural in three casings
      Count_A      : NATURAL := 0;   -- ALL CAPS type  ← case-bug #3
      Count_B      : natural := 0;   -- lowercase type ← case-bug #4
      Count_C      : Natural := 0;   -- original type  ← baseline

   begin
      --  [ASSIGN] Orida (UINT16) := Aran (uint16)
      --  Both sides have the same underlying type, different casing in decl
      --  Python bug (pre-fix): global_vars["Orida"] stored as key "orida"
      --  but Expr walk finds text "Orida" → name.lower() needed
      Local_Orida := UINT16 (Orida_In);   -- [ASSIGN] cast uses ALL CAPS type
      Local_Aran  := uint16 (Aran_In);    -- [ASSIGN] cast uses lowercase type
      Local_Karan := UInt16 (Local_Orida + Local_Aran);  -- [ASSIGN] original

      --  [IF-COND] condition uses variables typed with different casings
      --  Pattern directly matching: if (natural.Orida := Orida.Aran)
      --  Translated to valid Ada:
      if NATURAL (Local_Orida) = NATURAL (Local_Aran) then   -- [IF-COND] ALL CAPS cast   ← case-bug #5
         Count_A := NATURAL (Local_Karan);   -- [ASSIGN inside if] ALL CAPS ← case-bug #6
         Count_B := natural (Local_Karan);   -- [ASSIGN inside if] lower    ← case-bug #7

      elsif natural (Local_Orida) > natural (Local_Aran) then  -- [IF-COND] lowercase cast ← case-bug #8
         Count_B := natural (Orida_In);     -- [ASSIGN] global ref lowercase ← case-bug #9
         Count_C := Natural (Aran_In);      -- [ASSIGN] global ref original  ← baseline

      else
         --  [IF-COND] references GLOBAL Orida (declared UINT16 in .ads)
         --  with flipped casing — this is the exact pattern you described
         if UINT16 (Orida) = uint16 (Aran) then   -- [GLOBAL-REF] [IF-COND] ← case-bug #10
            Local_Karan := UINT16 (Karan);         -- [GLOBAL-REF] [ASSIGN]  ← case-bug #11
         end if;
         Count_C := Natural (Local_Karan);
      end if;

      --  [ASSIGN] final output — global ref with original casing
      Karan_Out := Local_Karan;

      --  [IF-COND] global Flag_Top (BOOLEAN in .ads) used as condition
      --  Python bug: "Flag_Top" Expr walk → p_type → type name "BOOLEAN"
      --  → resolve_type_name("BOOLEAN") → type_defs["boolean"] miss (pre-fix)
      if FLAG_TOP then                    -- [GLOBAL-REF] ALL CAPS name ← case-bug #12
         Count_A := Count_A + 1;
      end if;

      if flag_mid then                    -- [GLOBAL-REF] lowercase name ← case-bug #13
         Count_B := Count_B + 1;
      end if;

   end Check_Pixel;


   -- ----------------------------------------------------------------
   --  Update_Grid
   --  Locals: Integer and Float in three casings
   --  If-conditions reference globals Pos_X (INTEGER), Ratio_A (FLOAT)
   -- ----------------------------------------------------------------
   procedure Update_Grid
     (Row    : in  NATURAL;
      Col    : in  natural;
      Result : out Natural)
   is
      --  [LOCAL-DECL] Integer in three casings
      Step_A   : INTEGER := 0;    -- ALL CAPS type  ← case-bug #14
      Step_B   : integer := 0;    -- lowercase type ← case-bug #15
      Step_C   : Integer := 0;    -- original type  ← baseline

      --  [LOCAL-DECL] Float in three casings
      Scale_A  : FLOAT   := 1.0;  -- ALL CAPS type  ← case-bug #16
      Scale_B  : float   := 1.0;  -- lowercase type ← case-bug #17
      Scale_C  : Float   := 1.0;  -- original type  ← baseline

      --  [LOCAL-DECL] Natural in three casings (for result computation)
      Res_A    : NATURAL := 0;    -- ALL CAPS type  ← case-bug #18
      Res_B    : natural := 0;    -- lowercase type ← case-bug #19
      Res_C    : Natural := 0;    -- original type  ← baseline

   begin
      --  [ASSIGN] mixed-case type casts in assignments
      Step_A := INTEGER (Row);         -- [ASSIGN] ALL CAPS cast  ← case-bug #20
      Step_B := integer (Col);         -- [ASSIGN] lowercase cast ← case-bug #21
      Step_C := Integer (Row + Col);   -- [ASSIGN] original cast  ← baseline

      --  [IF-COND] global Pos_X (declared INTEGER in .ads)
      --  referenced here as "pos_x" (all lowercase) and "POS_X" (caps)
      if INTEGER (pos_x) > Step_A then       -- [GLOBAL-REF] lowercase name ← case-bug #22
         Scale_A := FLOAT (Step_A) / 2.0;   -- [ASSIGN inside if] ALL CAPS ← case-bug #23

      elsif POS_Y < integer (Step_B) then    -- [GLOBAL-REF] ALL CAPS name  ← case-bug #24
         Scale_B := float (Step_B) * 1.5;   -- [ASSIGN inside if] lower    ← case-bug #25

      else
         Scale_C := Float (Step_C);          -- [ASSIGN] original           ← baseline
      end if;

      --  [IF-COND] global Grid_Row (NATURAL in .ads) vs Grid_Col (natural)
      --  both referenced with flipped casing
      if NATURAL (grid_row) = natural (GRID_COL) then   -- [GLOBAL-REF] [IF-COND] ← case-bug #26
         Res_A := NATURAL (Row);    -- [ASSIGN] ALL CAPS  ← case-bug #27
         Res_B := natural (Col);    -- [ASSIGN] lowercase ← case-bug #28
      else
         Res_C := Natural (Row + Col);  -- [ASSIGN] original ← baseline
      end if;

      --  [IF-COND] global Ratio_A (FLOAT in .ads) referenced as "ratio_a"
      if ratio_a > FLOAT (Step_C) then         -- [GLOBAL-REF] lowercase ← case-bug #29
         Res_A := Res_A + NATURAL (ratio_b);   -- [GLOBAL-REF] lowercase ← case-bug #30
      elsif RATIO_C < float (Scale_C) then     -- [GLOBAL-REF] ALL CAPS  ← case-bug #31
         Res_B := Res_B + natural (RATIO_A);   -- [GLOBAL-REF] ALL CAPS  ← case-bug #32
      end if;

      Result := Res_C;
   end Update_Grid;


   -- ----------------------------------------------------------------
   --  Draw_Char  (original logic, local vars with mixed-case types)
   -- ----------------------------------------------------------------
   procedure Draw_Char
     (Buffer     : in out Bitmap_Buffer'Class;
      Start      : Point;
      Char       : Character;
      Font       : BMP_Font;
      Foreground : UInt32;
      Background : UInt32)
   is
      --  [LOCAL-DECL] UInt16 in three casings
      Px  : UINT16 := 0;   -- ALL CAPS  ← case-bug #33
      Py  : uint16 := 0;   -- lowercase ← case-bug #34
      Pz  : UInt16 := 0;   -- original  ← baseline

      --  [LOCAL-DECL] Boolean in three casings
      Ok_A : BOOLEAN := False;  -- ALL CAPS  ← case-bug #35
      Ok_B : boolean := False;  -- lowercase ← case-bug #36
      Ok_C : Boolean := False;  -- original  ← baseline

   begin
      --  [IF-COND] local UINT16 vs global Orida (UINT16 in .ads)
      --  referenced as "orida" lowercase → global_vars["orida"] lookup
      if UINT16 (orida) > Px then    -- [GLOBAL-REF] lowercase ← case-bug #37
         Ok_A := True;
      elsif uint16 (ARAN) < Py then  -- [GLOBAL-REF] ALL CAPS  ← case-bug #38
         Ok_B := True;
      else
         Ok_C := True;
      end if;

      --  [IF-COND] local BOOLEAN vs global Flag_Bot (Boolean in .ads)
      if BOOLEAN (Ok_A) = boolean (flag_bot) then   -- [GLOBAL-REF] mixed ← case-bug #39
         Px := UINT16 (Max_Orida);   -- [GLOBAL-REF] const original casing ← baseline
         Py := uint16 (MIN_ARAN);    -- [GLOBAL-REF] const ALL CAPS        ← case-bug #40
      end if;

      for H in 0 .. Char_Height (Font) - 1 loop
         for W in 0 .. Char_Width (Font) - 1 loop
            if (Data (Font, Char, H) and Mask (Font, W)) /= 0 then
               Buffer.Set_Source (Word_To_Bitmap_Color (Buffer.Color_Mode, Foreground));
               Buffer.Set_Pixel ((Start.X + W, Start.Y + H));
            else
               Buffer.Set_Source (Word_To_Bitmap_Color (Buffer.Color_Mode, Background));
               Buffer.Set_Pixel ((Start.X + W, Start.Y + H));
            end if;
         end loop;
      end loop;
   end Draw_Char;


   -- ----------------------------------------------------------------
   --  Draw_String  (local vars + global refs in if-conditions)
   -- ----------------------------------------------------------------
   procedure Draw_String
     (Buffer     : in out Bitmap_Buffer'Class;
      Start      : Point;
      Msg        : String;
      Font       : BMP_Font;
      Foreground : Bitmap_Color;
      Background : Bitmap_Color)
   is
      --  [LOCAL-DECL] Natural in three casings
      Count   : NATURAL := 0;    -- ALL CAPS  ← case-bug #41
      Tmp     : natural := 0;    -- lowercase ← case-bug #42
      Aux     : Natural := 0;    -- original  ← baseline

      --  [LOCAL-DECL] UInt32 in three casings
      FG      : constant UINT32 :=             -- ALL CAPS  ← case-bug #43
                  Bitmap_Color_To_Word (Buffer.Color_Mode, Foreground);
      BG      : constant uint32 :=             -- lowercase ← case-bug #44
                  Bitmap_Color_To_Word (Buffer.Color_Mode, Background);
      Aux_FG  : constant UInt32 :=             -- original  ← baseline
                  Bitmap_Color_To_Word (Buffer.Color_Mode, Foreground);

   begin
      --  [IF-COND] global Grid_Row (NATURAL) referenced as "GRID_ROW"
      if NATURAL (GRID_ROW) > Count then       -- [GLOBAL-REF] ALL CAPS ← case-bug #45
         Tmp := natural (grid_col);            -- [GLOBAL-REF] lowercase ← case-bug #46
      end if;

      for C of Msg loop
         exit when Start.X + Count * Char_Width (Font) > Buffer.Width;
         Draw_Char (Buffer,
                    (Start.X + Count * Char_Width (Font), Start.Y),
                    C, Font, UINT32 (FG), uint32 (BG));  -- casts ← case-bug #47 #48
         Count := Count + 1;
      end loop;
   end Draw_String;

end Bitmapped_Drawing;
