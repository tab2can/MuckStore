; Muck Store NSIS chrome: Windows dark mode, painted buttons, readable copy.
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

!define MUCK_BG 0x00110D0B
!define MUCK_ELEV 0x004A4038
!define MUCK_INK 0x00E1E8EC
!define MUCK_MUTED 0x00B7A49A
!define MUCK_COPPER 0x0056A0D4
!define MUCK_COPPER_INK 0x0008141A
!define MUCK_DISABLED_BG 0x00201814
!define MUCK_DISABLED_INK 0x0080736B
!define MUCK_COPPER_HOT 0x006BB8E8
!define MUCK_ELEV_HOT 0x005C4E46
!define MUCK_EDIT_BG 0x00261C16

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

!macro MuckInitDarkMode
  Push $0
  Push $1
  System::Call 'kernel32::GetModuleHandle(t "uxtheme.dll") i .r0'
  ${If} $0 != 0
    System::Call 'kernel32::GetProcAddress(i r0, i 132) i .r1'
    ${If} $1 != 0
      System::Call '::$1(i 1)'
    ${EndIf}
    System::Call 'kernel32::GetProcAddress(i r0, i 135) i .r1'
    ${If} $1 != 0
      System::Call '::$1(i 2)'
    ${EndIf}
    System::Call 'kernel32::GetProcAddress(i r0, i 136) i .r1'
    ${If} $1 != 0
      System::Call '::$1()'
    ${EndIf}
    System::Call 'kernel32::GetProcAddress(i r0, i 133) i .s'
    Pop $MuckAllowDark
  ${EndIf}
  ${If} $MuckBgBrush == 0
    System::Call 'gdi32::CreateSolidBrush(i ${MUCK_BG}) i .s'
    Pop $MuckBgBrush
  ${EndIf}
  Pop $1
  Pop $0
!macroend

!macro MuckAllowDarkWindow HWND
  ${If} ${HWND} != 0
    ${If} $MuckAllowDark != 0
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
      System::Call 'gdi32::CreateSolidBrush(i ${MUCK_COPPER_HOT}) i .R5'
    ${Else}
      System::Call 'gdi32::CreateSolidBrush(i ${MUCK_COPPER}) i .R5'
    ${EndIf}
    IntOp $R6 ${MUCK_COPPER_INK} + 0
  ${ElseIf} $R0 == 0
    System::Call 'gdi32::CreateSolidBrush(i ${MUCK_DISABLED_BG}) i .R5'
    IntOp $R6 ${MUCK_DISABLED_INK} + 0
  ${Else}
    ${If} $0 == $MuckHoverHwnd
      System::Call 'gdi32::CreateSolidBrush(i ${MUCK_ELEV_HOT}) i .R5'
    ${Else}
      System::Call 'gdi32::CreateSolidBrush(i ${MUCK_ELEV}) i .R5'
    ${EndIf}
    IntOp $R6 ${MUCK_INK} + 0
  ${EndIf}

  System::Call 'user32::FillRect(i R2, i R3, i R5)'
  System::Call 'gdi32::DeleteObject(i R5)'

  ; 1px corner cut so the fill does not look like a Win32 slab.
  System::Call 'gdi32::SetPixel(i R2, i 0, i 0, i ${MUCK_BG})'
  System::Call '*$R3(i, i, i .R5, i .R9)'
  IntOp $R5 $R5 - 1
  IntOp $R9 $R9 - 1
  System::Call 'gdi32::SetPixel(i R2, i R5, i 0, i ${MUCK_BG})'
  System::Call 'gdi32::SetPixel(i R2, i 0, i R9, i ${MUCK_BG})'
  System::Call 'gdi32::SetPixel(i R2, i R5, i R9, i ${MUCK_BG})'

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
  SetCtlColors $0 ECE8E1 0B0D11
  System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'
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
  SetCtlColors $0 ECE8E1 161C26
  System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'
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
        SetCtlColors $0 ECE8E1 0B0D11
      ${EndIf}

    ${ElseIf} $R9 == "Edit"
      !insertmacro MuckSkinEdit

    ${ElseIf} $R9 == "RichEdit20A"
    ${OrIf} $R9 == "RichEdit20W"
    ${OrIf} $R9 == "RichEdit50W"
      SetCtlColors $0 ECE8E1 0B0D11
      SendMessage $0 ${EM_SETBKGNDCOLOR} 0 ${MUCK_BG}
      System::Alloc 92
      Pop $R7
      System::Call '*$R7(i 92, i 0x40000000, i 0, i 0, i 0, i ${MUCK_INK})'
      SendMessage $0 ${EM_SETCHARFORMAT} 4 $R7
      System::Free $R7
      System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'

    ${ElseIf} $R9 == "SysListView32"
      SendMessage $0 ${LVM_SETBKCOLOR} 0 ${MUCK_BG}
      SendMessage $0 ${LVM_SETTEXTBKCOLOR} 0 ${MUCK_BG}
      SendMessage $0 ${LVM_SETTEXTCOLOR} 0 ${MUCK_INK}
      System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'

    ${ElseIf} $R9 == "SysTreeView32"
      SendMessage $0 0x111D 0 ${MUCK_BG}
      SendMessage $0 0x111E 0 ${MUCK_INK}
      SendMessage $0 0x1129 0 ${MUCK_BG}
      System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'

    ${ElseIf} $R9 == "ListBox"
      SetCtlColors $0 ECE8E1 0B0D11
      System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'
      SendMessage $0 0x031A 0 0

    ${ElseIf} $R9 == "ScrollBar"
      System::Call 'uxtheme::SetWindowTheme(i $0, w "DarkMode_Explorer", n)'
      SendMessage $0 0x031A 0 0

    ${ElseIf} $R9 == "ComboBox"
      System::Call 'user32::GetWindowLong(i $0, i -20) i .R7'
      IntOp $R7 $R7 & 0xFFFFFDFF
      System::Call 'user32::SetWindowLong(i $0, i -20, i R7)'
      System::Call 'uxtheme::SetWindowTheme(i $0, w " ", w " ")'
      SetCtlColors $0 ECE8E1 161C26

    ${ElseIf} $R9 == "msctls_progress32"
      System::Call 'uxtheme::SetWindowTheme(i $0, w " ", w " ")'
      SendMessage $0 ${PBM_SETBKCOLOR} 0 ${MUCK_ELEV}
      SendMessage $0 ${PBM_SETBARCOLOR} 0 ${MUCK_COPPER}

    ${ElseIf} $R9 == "#32770"
      SetCtlColors $0 ECE8E1 0B0D11
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
  SetCtlColors $HWNDPARENT ECE8E1 0B0D11
  System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i 1, i 4)'
  !insertmacro MuckAllowDarkWindow $HWNDPARENT
  System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", n)'
  ${If} $MuckBgBrush != 0
    System::Call 'user32::SetClassLong(i $HWNDPARENT, i -10, i $MuckBgBrush)'
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1018
  ${If} $0 != 0
    SetCtlColors $0 ECE8E1 0B0D11
    ${If} $MuckBgBrush != 0
      System::Call 'user32::SetClassLong(i $0, i -10, i $MuckBgBrush)'
    ${EndIf}
  ${EndIf}
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    SetCtlColors $0 ECE8E1 0B0D11
    ${If} $MuckBgBrush != 0
      System::Call 'user32::SetClassLong(i $0, i -10, i $MuckBgBrush)'
    ${EndIf}
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1028
  ${If} $0 != 0
    SetCtlColors $0 9AA4B7 0B0D11
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1037
  ${If} $0 != 0
    SetCtlColors $0 ECE8E1 0B0D11
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1040
  ${If} $0 != 0
    SetCtlColors $0 9AA4B7 0B0D11
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
