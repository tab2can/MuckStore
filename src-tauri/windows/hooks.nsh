; Muck Store NSIS chrome: follow Windows light/dark + accent, painted buttons.
; Push buttons ignore SetCtlColors. Empty SetWindowTheme also kills visual styles
; and leaves classic MSI chrome — never strip themes from Next/Back/Cancel.

!include LogicLib.nsh
!include WinMessages.nsh

!define /ifndef MUI_BGCOLOR "0B0D11"
!define /ifndef MUI_TEXTCOLOR "ECE8E1"
!define /ifndef MUI_INSTALLCOLORS "ECE8E1 0B0D11"
!define /ifndef MUI_INSTFILESPAGE_COLORS "ECE8E1 0B0D11"
!define /ifndef MUI_INSTFILESPAGE_PROGRESSBAR "colored"
!define /ifndef MUI_LICENSEPAGE_BGCOLOR "0B0D11"
!define /ifndef MUI_WELCOMEPAGE_TITLE "$(MUCK_WELCOME_TITLE)"
!define /ifndef MUI_WELCOMEPAGE_TEXT "$(MUCK_WELCOME_TEXT)"
!define /ifndef MUI_FINISHPAGE_TITLE "$(MUCK_FINISH_TITLE)"
!define /ifndef MUI_FINISHPAGE_TEXT "$(MUCK_FINISH_TEXT)"
!define MUI_CUSTOMFUNCTION_GUIINIT MuckOnGuiInit
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.MuckOnGuiInit

!define /ifndef BM_SETIMAGE 0x00F7
!define /ifndef IMAGE_BITMAP 0
!define /ifndef PBM_SETBARCOLOR 0x0409
!define /ifndef PBM_SETBKCOLOR 0x2001
!define /ifndef EM_SETBKGNDCOLOR 0x0443
!define /ifndef EM_SETCHARFORMAT 0x0444
!define /ifndef LVM_SETBKCOLOR 0x1001
!define /ifndef LVM_SETTEXTCOLOR 0x1024
!define /ifndef LVM_SETTEXTBKCOLOR 0x1026
!define /ifndef GW_HWNDNEXT 2
!define /ifndef GW_CHILD 5

Var MuckAllowDark
Var MuckBgBrush
Var MuckPaintPrimaryHwnd
Var MuckHoverHwnd
Var MuckTimerOn
Var MuckDark
Var MuckHighContrast
Var MuckUxTheme
Var MuckColBg
Var MuckColElev
Var MuckColInk
Var MuckColCopper
Var MuckColCopperInk
Var MuckColCopperHot
Var MuckColElevHot
Var MuckColDisabledBg
Var MuckColDisabledInk

; SetCtlColors bakes colors at compile time — never pass hex in a variable.
!macro MuckSetCtlColors HWND
  ${If} $MuckHighContrast == 1
    SetCtlColors ${HWND} FFFFFF 000000
  ${ElseIf} $MuckDark == 0
    SetCtlColors ${HWND} 1C1814 F3EEE6
  ${Else}
    SetCtlColors ${HWND} ECE8E1 0B0D11
  ${EndIf}
!macroend
!macro MuckSetCtlEdit HWND
  ${If} $MuckHighContrast == 1
    SetCtlColors ${HWND} FFFFFF 0A0A0A
  ${ElseIf} $MuckDark == 0
    SetCtlColors ${HWND} 1C1814 FFFFFF
  ${Else}
    SetCtlColors ${HWND} ECE8E1 161C26
  ${EndIf}
!macroend
!macro MuckSetCtlMuted HWND
  ${If} $MuckHighContrast == 1
    SetCtlColors ${HWND} D0D0D0 000000
  ${ElseIf} $MuckDark == 0
    SetCtlColors ${HWND} 6B6358 F3EEE6
  ${Else}
    SetCtlColors ${HWND} 9AA4B7 0B0D11
  ${EndIf}
!macroend

!macro MuckInitPaletteImpl
  Push $0
  Push $1
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5

  StrCpy $MuckHighContrast 0
  StrCpy $MuckDark 1
  System::Alloc 24
  Pop $0
  System::Call '*$0(i 24)'
  System::Call 'user32::SystemParametersInfo(i 66, i 24, p r0, i 0)'
  System::Call '*$0(i, i .r1)'
  System::Free $0
  IntOp $1 $1 & 1
  ${If} $1 == 1
    StrCpy $MuckHighContrast 1
    StrCpy $MuckDark 1
    StrCpy $MuckColBg 0x00000000
    StrCpy $MuckColElev 0x000A0A0A
    StrCpy $MuckColInk 0x00FFFFFF
    StrCpy $MuckColCopper 0x0000FFFF
    StrCpy $MuckColCopperInk 0x00000000
    StrCpy $MuckColCopperHot 0x0066FFFF
    StrCpy $MuckColElevHot 0x001A1A1A
    StrCpy $MuckColDisabledBg 0x001A1A1A
    StrCpy $MuckColDisabledInk 0x00D0D0D0
    StrCpy $MuckUxTheme "DarkMode_Explorer"
  ${Else}
    ClearErrors
    ReadRegDWORD $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "AppsUseLightTheme"
    ${If} ${Errors}
      StrCpy $0 0
    ${EndIf}
    ${If} $0 == 1
      StrCpy $MuckDark 0
      StrCpy $MuckColBg 0x00E6EEF3
      StrCpy $MuckColElev 0x00F1F7FB
      StrCpy $MuckColInk 0x0014181C
      StrCpy $MuckColCopper 0x001A5B9A
      StrCpy $MuckColCopperInk 0x00EFF8FF
      StrCpy $MuckColCopperHot 0x002870B4
      StrCpy $MuckColElevHot 0x00DCE8EF
      StrCpy $MuckColDisabledBg 0x00DCE8EF
      StrCpy $MuckColDisabledInk 0x0058636B
      StrCpy $MuckUxTheme "Explorer"
    ${Else}
      StrCpy $MuckDark 1
      StrCpy $MuckColBg 0x00110D0B
      StrCpy $MuckColElev 0x004A4038
      StrCpy $MuckColInk 0x00E1E8EC
      StrCpy $MuckColCopper 0x0056A0D4
      StrCpy $MuckColCopperInk 0x0008141A
      StrCpy $MuckColCopperHot 0x006BB8E8
      StrCpy $MuckColElevHot 0x005C4E46
      StrCpy $MuckColDisabledBg 0x00201814
      StrCpy $MuckColDisabledInk 0x0080736B
      StrCpy $MuckUxTheme "DarkMode_Explorer"
    ${EndIf}

    ${If} $MuckHighContrast == 0
      ClearErrors
      ReadRegDWORD $0 HKCU "Software\Microsoft\Windows\DWM" "AccentColor"
      ${IfNot} ${Errors}
        IntOp $0 $0 & 0x00FFFFFF
        IntOp $R1 $0 & 0xFF
        IntOp $R2 $0 / 256
        IntOp $R2 $R2 & 0xFF
        IntOp $R3 $0 / 65536
        IntOp $R3 $R3 & 0xFF
        IntOp $R4 $R1 + $R2
        IntOp $R4 $R4 + $R3
        ${If} $R4 > 40
        ${AndIf} $R4 < 735
          StrCpy $MuckColCopper $0
          IntOp $R4 $R1 * 54
          IntOp $R5 $R2 * 183
          IntOp $R4 $R4 + $R5
          IntOp $R5 $R3 * 19
          IntOp $R4 $R4 + $R5
          IntOp $R4 $R4 / 256
          ${If} $R4 > 140
            StrCpy $MuckColCopperInk 0x0008141A
          ${Else}
            StrCpy $MuckColCopperInk 0x00EFF8FF
          ${EndIf}
          IntOp $R1 $R1 + 28
          IntOp $R2 $R2 + 28
          IntOp $R3 $R3 + 28
          ${If} $R1 > 255
            StrCpy $R1 255
          ${EndIf}
          ${If} $R2 > 255
            StrCpy $R2 255
          ${EndIf}
          ${If} $R3 > 255
            StrCpy $R3 255
          ${EndIf}
          IntOp $R5 $R3 * 65536
          IntOp $R4 $R2 * 256
          IntOp $R5 $R5 + $R4
          IntOp $R5 $R5 + $R1
          StrCpy $MuckColCopperHot $R5
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}

  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $1
  Pop $0
!macroend

!macro MuckInitDarkMode
  !insertmacro MuckInitPaletteImpl
  Push $0
  Push $1
  System::Call 'kernel32::GetModuleHandle(t "uxtheme.dll") i .r0'
  ${If} $0 != 0
    System::Call 'kernel32::GetProcAddress(i r0, i 132) i .r1'
    ${If} $1 != 0
      System::Call '::$1(i $MuckDark)'
    ${EndIf}
    System::Call 'kernel32::GetProcAddress(i r0, i 135) i .r1'
    ${If} $1 != 0
      ${If} $MuckDark == 1
        System::Call '::$1(i 2)'
      ${Else}
        System::Call '::$1(i 3)'
      ${EndIf}
    ${EndIf}
    System::Call 'kernel32::GetProcAddress(i r0, i 136) i .r1'
    ${If} $1 != 0
      System::Call '::$1()'
    ${EndIf}
    ${If} $MuckDark == 1
      System::Call 'kernel32::GetProcAddress(i r0, i 133) i .s'
      Pop $MuckAllowDark
    ${Else}
      StrCpy $MuckAllowDark 0
    ${EndIf}
  ${EndIf}
  ${If} $MuckBgBrush != 0
    System::Call 'gdi32::DeleteObject(i $MuckBgBrush)'
    StrCpy $MuckBgBrush 0
  ${EndIf}
  System::Call 'gdi32::CreateSolidBrush(i $MuckColBg) i .s'
  Pop $MuckBgBrush
  Pop $1
  Pop $0
!macroend

!macro MuckAllowDarkWindow HWND
  ${If} ${HWND} != 0
    ${If} $MuckDark == 1
    ${AndIf} $MuckAllowDark != 0
      Push $9
      StrCpy $9 $MuckAllowDark
      System::Call '::$9(i ${HWND}, i 1)'
      Pop $9
    ${EndIf}
  ${EndIf}
!macroend

!macro MuckPaintPushButton
  ; $0 = button HWND. Preserve $0-$2.
  Push $1
  Push $2
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9

  System::Call '*(i 0, i 0, i 0, i 0) i .R3'
  System::Call 'user32::GetClientRect(i $0, i R3)'
  System::Call '*$R3(i, i, i .R6, i .R7)'
  ${If} $R6 >= 12
  ${AndIf} $R7 >= 12
  System::Call 'user32::GetDC(i $0) i .R1'
  System::Call 'gdi32::CreateCompatibleDC(i R1) i .R2'
  System::Call 'gdi32::CreateCompatibleBitmap(i R1, i R6, i R7) i .R4'
  System::Call 'gdi32::SelectObject(i R2, i R4) i .R8'

  System::Call 'user32::IsWindowEnabled(i $0) i .R0'
  System::Call 'user32::GetDlgCtrlID(i $0) i .R9'
  ${If} $0 == $MuckPaintPrimaryHwnd
  ${OrIf} $R9 == 1
    ${If} $0 == $MuckHoverHwnd
      System::Call 'gdi32::CreateSolidBrush(i $MuckColCopperHot) i .R5'
    ${Else}
      System::Call 'gdi32::CreateSolidBrush(i $MuckColCopper) i .R5'
    ${EndIf}
    IntOp $R6 $MuckColCopperInk + 0
  ${ElseIf} $R0 == 0
    System::Call 'gdi32::CreateSolidBrush(i $MuckColDisabledBg) i .R5'
    IntOp $R6 $MuckColDisabledInk + 0
  ${Else}
    ${If} $0 == $MuckHoverHwnd
      System::Call 'gdi32::CreateSolidBrush(i $MuckColElevHot) i .R5'
    ${Else}
      System::Call 'gdi32::CreateSolidBrush(i $MuckColElev) i .R5'
    ${EndIf}
    IntOp $R6 $MuckColInk + 0
  ${EndIf}

  System::Call 'user32::FillRect(i R2, i R3, i R5)'
  System::Call 'gdi32::DeleteObject(i R5)'

  ; 1px corner cut so the fill does not look like a Win32 slab.
  System::Call 'gdi32::SetPixel(i R2, i 0, i 0, i $MuckColBg)'
  System::Call '*$R3(i, i, i .R5, i .R9)'
  IntOp $R5 $R5 - 1
  IntOp $R9 $R9 - 1
  System::Call 'gdi32::SetPixel(i R2, i R5, i 0, i $MuckColBg)'
  System::Call 'gdi32::SetPixel(i R2, i 0, i R9, i $MuckColBg)'
  System::Call 'gdi32::SetPixel(i R2, i R5, i R9, i $MuckColBg)'

  System::Call 'user32::GetWindowText(i $0, t .R5, i 512)'
  SendMessage $0 ${WM_GETFONT} 0 0 $R9
  ${If} $R9 == 0
    SendMessage $HWNDPARENT ${WM_GETFONT} 0 0 $R9
  ${EndIf}
  ${If} $R9 == 0
    System::Call 'gdi32::GetStockObject(i 17) i .R9'
  ${EndIf}
  ${If} $R9 != 0
    System::Call 'gdi32::SelectObject(i R2, i R9)'
  ${EndIf}
  System::Call 'gdi32::SetBkMode(i R2, i 1)'
  System::Call 'gdi32::SetTextColor(i R2, i R6)'
  System::Call 'user32::DrawText(i R2, t R5, i -1, i R3, i 0x25)'

  System::Call 'gdi32::SelectObject(i R2, i R8)'
  System::Call 'gdi32::DeleteDC(i R2)'
  System::Call 'user32::ReleaseDC(i $0, i R1)'
  System::Free $R3

  System::Call 'user32::GetWindowLong(i $0, i -16) i .R1'
  IntOp $R2 $R1 | 0x80
  System::Call 'user32::SetWindowLong(i $0, i -16, i R2)'
  SendMessage $0 ${BM_SETIMAGE} ${IMAGE_BITMAP} $R4 $R8
  ${If} $R8 != 0
  ${AndIf} $R8 != $R4
    System::Call 'gdi32::DeleteObject(i R8)'
  ${EndIf}
  System::Call 'user32::SetWindowPos(i $0, i 0, i 0, i 0, i 0, i 0, i 0x37)'
  ${Else}
    System::Free $R3
  ${EndIf}

  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $2
  Pop $1
!macroend

; Native Win11 check/radio (the blue tick). Do not BS_BITMAP-paint —
; that draws a second copper box beside the system glyph.
!macro MuckSkinToggle
  Push $R7
  System::Call 'user32::GetWindowLong(i $0, i -16) i .R7'
  IntOp $R7 $R7 & 0xFFFFFF7F
  System::Call 'user32::SetWindowLong(i $0, i -16, i R7)'
  !insertmacro MuckSetCtlColors $0
  System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'
  SendMessage $0 0x031A 0 0
  System::Call 'user32::SetWindowPos(i $0, i 0, i 0, i 0, i 0, i 0, i 0x37)'
  Pop $R7
!macroend

; Path boxes: strip the classic 3D/client edge (the white halo) then restyle.
!macro MuckSkinEdit
  Push $R7
  Push $R8
  System::Call 'user32::GetWindowLong(i $0, i -16) i .R7'
  IntOp $R8 $R7 & 0x4
  ${If} $R8 == 0
    IntOp $R7 $R7 & 0xFF7FFFFF
    System::Call 'user32::SetWindowLong(i $0, i -16, i R7)'
  ${EndIf}
  System::Call 'user32::GetWindowLong(i $0, i -20) i .R7'
  IntOp $R7 $R7 & 0xFFFFFDFF
  IntOp $R7 $R7 & 0xFFFDFFFF
  IntOp $R7 $R7 & 0xFFFFFEFF
  IntOp $R7 $R7 & 0xFFFFFFFE
  System::Call 'user32::SetWindowLong(i $0, i -20, i R7)'
  !insertmacro MuckSetCtlEdit $0
  System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'
  SendMessage $0 0x031A 0 0
  System::Call 'user32::SetWindowPos(i $0, i 0, i 0, i 0, i 0, i 0, i 0x37)'
  Pop $R8
  Pop $R7
!macroend

!macro MuckSkinControl
  ; $0 = HWND. Preserve $0-$2.
  Push $1
  Push $R9
  Push $R8
  Push $R7

  ${If} $0 != 0
    !insertmacro MuckAllowDarkWindow $0
    System::Call 'user32::GetClassName(i $0, t .R9, i 64)'
    System::Call 'user32::GetWindowLong(i $0, i -16) i .R8'

    ${If} $R9 == "Button"
      IntOp $R7 $R8 & 0xF
      ${If} $R7 == 0
      ${OrIf} $R7 == 1
        !insertmacro MuckPaintPushButton
      ${ElseIf} $R7 == 2
      ${OrIf} $R7 == 3
      ${OrIf} $R7 == 4
      ${OrIf} $R7 == 5
      ${OrIf} $R7 == 6
      ${OrIf} $R7 == 9
        !insertmacro MuckSkinToggle
      ${ElseIf} $R7 == 7
        ShowWindow $0 ${SW_HIDE}
      ${EndIf}

    ${ElseIf} $R9 == "Static"
      IntOp $R7 $R8 & 0x1F
      ${If} $R7 == 4
      ${OrIf} $R7 == 5
      ${OrIf} $R7 == 6
      ${OrIf} $R7 == 7
      ${OrIf} $R7 == 8
      ${OrIf} $R7 == 9
      ${OrIf} $R7 == 16
      ${OrIf} $R7 == 18
        ShowWindow $0 ${SW_HIDE}
      ${Else}
        !insertmacro MuckSetCtlColors $0
      ${EndIf}

    ${ElseIf} $R9 == "Edit"
      !insertmacro MuckSkinEdit

    ${ElseIf} $R9 == "RichEdit20A"
    ${OrIf} $R9 == "RichEdit20W"
    ${OrIf} $R9 == "RichEdit50W"
      !insertmacro MuckSetCtlColors $0
      SendMessage $0 ${EM_SETBKGNDCOLOR} 0 $MuckColBg
      System::Alloc 92
      Pop $R7
      System::Call '*$R7(i 92, i 0x40000000, i 0, i 0, i 0, i $MuckColInk)'
      SendMessage $0 ${EM_SETCHARFORMAT} 4 $R7
      System::Free $R7
      System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'

    ${ElseIf} $R9 == "SysListView32"
      SendMessage $0 ${LVM_SETBKCOLOR} 0 $MuckColBg
      SendMessage $0 ${LVM_SETTEXTBKCOLOR} 0 $MuckColBg
      SendMessage $0 ${LVM_SETTEXTCOLOR} 0 $MuckColInk
      System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'

    ${ElseIf} $R9 == "SysTreeView32"
      SendMessage $0 0x111D 0 $MuckColBg
      SendMessage $0 0x111E 0 $MuckColInk
      SendMessage $0 0x1129 0 $MuckColBg
      System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'

    ${ElseIf} $R9 == "ListBox"
      !insertmacro MuckSetCtlColors $0
      System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'
      SendMessage $0 0x031A 0 0

    ${ElseIf} $R9 == "ScrollBar"
      System::Call 'uxtheme::SetWindowTheme(i $0, w "$MuckUxTheme", n)'
      SendMessage $0 0x031A 0 0

    ${ElseIf} $R9 == "ComboBox"
      System::Call 'user32::GetWindowLong(i $0, i -20) i .R7'
      IntOp $R7 $R7 & 0xFFFFFDFF
      System::Call 'user32::SetWindowLong(i $0, i -20, i R7)'
      System::Call 'uxtheme::SetWindowTheme(i $0, w " ", w " ")'
      !insertmacro MuckSetCtlEdit $0

    ${ElseIf} $R9 == "msctls_progress32"
      System::Call 'uxtheme::SetWindowTheme(i $0, w " ", w " ")'
      SendMessage $0 ${PBM_SETBKCOLOR} 0 $MuckColElev
      SendMessage $0 ${PBM_SETBARCOLOR} 0 $MuckColCopper

    ${ElseIf} $R9 == "#32770"
      !insertmacro MuckSetCtlColors $0
      ${If} $MuckBgBrush != 0
        System::Call 'user32::SetClassLong(i $0, i -10, i $MuckBgBrush)'
      ${EndIf}
    ${EndIf}
  ${EndIf}

  Pop $R7
  Pop $R8
  Pop $R9
  Pop $1
!macroend

!macro MuckSkinTreeFn UN
Function ${UN}MuckSkinTree
  Exch $0
  Push $1
  Push $2
  !insertmacro MuckSkinControl
  System::Call 'user32::GetWindow(i $0, i ${GW_CHILD}) i .r1'
  ${While} $1 != 0
    System::Call 'user32::GetWindow(i $1, i ${GW_HWNDNEXT}) i .r2'
    Push $2
    Push $1
    Call ${UN}MuckSkinTree
    Pop $2
    StrCpy $1 $2
  ${EndWhile}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!macroend
!insertmacro MuckSkinTreeFn ""
!insertmacro MuckSkinTreeFn "un."

!macro MuckPaintHoverTarget
  Push $R7
  Push $R8
  System::Call 'user32::GetClassName(i $0, t .R8, i 64)'
  ${If} $R8 == "Button"
    System::Call 'user32::GetWindowLong(i $0, i -16) i .R8'
    IntOp $R7 $R8 & 0xF
    ${If} $R7 == 0
    ${OrIf} $R7 == 1
      !insertmacro MuckPaintPushButton
    ${EndIf}
  ${EndIf}
  Pop $R8
  Pop $R7
!macroend

!macro MuckHoverTickImpl
  Push $0
  Push $R0
  Push $R1
  Push $R9

  System::Call '*(i 0, i 0) i .R0'
  System::Call 'user32::GetCursorPos(i R0)'
  System::Call '*$R0(l .R1)'
  System::Free $R0
  System::Call 'user32::WindowFromPoint(l R1) i .R1'

  StrCpy $R9 0
  ${If} $R1 != 0
    System::Call 'user32::GetClassName(i $R1, t .R0, i 64)'
    ${If} $R0 == "Button"
      System::Call 'user32::GetWindowLong(i $R1, i -16) i .R0'
      IntOp $R0 $R0 & 0xF
      ${If} $R0 == 0
      ${OrIf} $R0 == 1
        StrCpy $R9 $R1
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} $R9 != $MuckHoverHwnd
    StrCpy $0 $MuckHoverHwnd
    StrCpy $MuckHoverHwnd $R9
    ${If} $0 != 0
      !insertmacro MuckPaintHoverTarget
    ${EndIf}
    ${If} $MuckHoverHwnd != 0
      StrCpy $0 $MuckHoverHwnd
      !insertmacro MuckPaintHoverTarget
    ${EndIf}
  ${EndIf}

  Pop $R9
  Pop $R1
  Pop $R0
  Pop $0
!macroend

; Keep Next/Back from sitting flush. Always measure from Cancel so SHOW is idempotent.
!macro MuckSpaceNavButtons
  Push $0
  Push $1
  Push $2
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6

  GetDlgItem $0 $HWNDPARENT 2
  GetDlgItem $1 $HWNDPARENT 1
  GetDlgItem $2 $HWNDPARENT 3
  ${If} $0 != 0
  ${AndIf} $1 != 0
      System::Call '*(i 0, i 0, i 0, i 0) i .R4'
      System::Call 'user32::GetWindowRect(i $0, i R4)'
      System::Call 'user32::ScreenToClient(i $HWNDPARENT, i R4)'
      System::Call '*$R4(i .R0, i .R1, i, i)'

      System::Call 'user32::GetWindowRect(i $1, i R4)'
      System::Call '*$R4(i .R2, i, i .R3, i)'
      IntOp $R6 $R3 - $R2
      IntOp $R2 $R0 - 10
      IntOp $R2 $R2 - $R6
      System::Call 'user32::SetWindowPos(i $1, i 0, i R2, i R1, i 0, i 0, i 0x15)'

      ${If} $2 != 0
        System::Call 'user32::GetWindowRect(i $2, i R4)'
        System::Call '*$R4(i .R5, i, i .R3, i)'
        IntOp $R5 $R3 - $R5
        IntOp $R3 $R2 - 10
        IntOp $R3 $R3 - $R5
        System::Call 'user32::SetWindowPos(i $2, i 0, i R3, i R1, i 0, i 0, i 0x15)'
      ${EndIf}

      System::Free $R4
  ${EndIf}

  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro MuckApplyChrome UN
  Push $0
  !insertmacro MuckSetCtlColors $HWNDPARENT
  System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i $MuckDark, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i $MuckDark, i 4)'
  !insertmacro MuckAllowDarkWindow $HWNDPARENT
  System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "$MuckUxTheme", n)'
  ${If} $MuckBgBrush != 0
    System::Call 'user32::SetClassLong(i $HWNDPARENT, i -10, i $MuckBgBrush)'
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1018
  ${If} $0 != 0
    !insertmacro MuckSetCtlColors $0
    ${If} $MuckBgBrush != 0
      System::Call 'user32::SetClassLong(i $0, i -10, i $MuckBgBrush)'
    ${EndIf}
  ${EndIf}
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    !insertmacro MuckSetCtlColors $0
    ${If} $MuckBgBrush != 0
      System::Call 'user32::SetClassLong(i $0, i -10, i $MuckBgBrush)'
    ${EndIf}
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1028
  ${If} $0 != 0
    !insertmacro MuckSetCtlMuted $0
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1037
  ${If} $0 != 0
    !insertmacro MuckSetCtlColors $0
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1040
  ${If} $0 != 0
    !insertmacro MuckSetCtlMuted $0
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1045
  ${If} $0 != 0
    ShowWindow $0 ${SW_HIDE}
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1256
  ${If} $0 != 0
    ShowWindow $0 ${SW_HIDE}
  ${EndIf}

  !insertmacro MuckSpaceNavButtons
  Push $HWNDPARENT
  Call ${UN}MuckSkinTree
  System::Call 'user32::InvalidateRect(i $HWNDPARENT, i 0, i 1)'
  Pop $0
!macroend

Function MuckInitPalette
  !insertmacro MuckInitPaletteImpl
FunctionEnd

Function un.MuckInitPalette
  !insertmacro MuckInitPaletteImpl
FunctionEnd

Function MuckHoverTick
  !insertmacro MuckHoverTickImpl
FunctionEnd

Function un.MuckHoverTick
  !insertmacro MuckHoverTickImpl
FunctionEnd

Function MuckOnGuiInit
  !insertmacro MuckInitDarkMode
  !insertmacro MuckApplyChrome ""
  ${If} $MuckTimerOn == 0
    GetFunctionAddress $0 MuckHoverTick
    System::Call 'user32::SetTimer(i $HWNDPARENT, i 1977, i 50, k r0)'
    StrCpy $MuckTimerOn 1
  ${EndIf}
FunctionEnd

Function un.MuckOnGuiInit
  !insertmacro MuckInitDarkMode
  !insertmacro MuckApplyChrome "un."
  ${If} $MuckTimerOn == 0
    GetFunctionAddress $0 un.MuckHoverTick
    System::Call 'user32::SetTimer(i $HWNDPARENT, i 1977, i 50, k r0)'
    StrCpy $MuckTimerOn 1
  ${EndIf}
FunctionEnd

Function MuckOnPageShow
  !insertmacro MuckApplyChrome ""
FunctionEnd

Function MuckPaintButton
  !insertmacro MuckPaintPushButton
FunctionEnd

Function un.MuckOnPageShow
  !insertmacro MuckApplyChrome "un."
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM muck-updater.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM "${MAINBINARYNAME}.exe" /T'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$INSTDIR\muck-updater.exe"
    StrCpy $R9 "$INSTDIR\muck-updater.exe"
  ${Else}
    StrCpy $R9 "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}

  !insertmacro MUI_STARTMENU_GETFOLDER Application $AppStartMenuFolder
  ${If} ${FileExists} "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    CreateShortCut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$R9" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  ${EndIf}
  ${If} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortCut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$R9" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  ${EndIf}
  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$R9" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  ${EndIf}
  Call MuckOnPageShow
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'taskkill /F /IM muck-updater.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM "${MAINBINARYNAME}.exe" /T'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
