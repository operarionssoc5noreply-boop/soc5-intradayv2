from __future__ import annotations

import html
import zipfile
from pathlib import Path


OUT = Path("docs/SOC5_Bot_Tutorial_Presentation.pptx")
SLIDE_W = 13_333_333
SLIDE_H = 7_500_000


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def rels(rels_xml: list[tuple[str, str, str]]) -> str:
    items = "\n".join(
        f'<Relationship Id="{rid}" Type="{typ}" Target="{target}"/>'
        for rid, typ, target in rels_xml
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        f"{items}\n"
        "</Relationships>"
    )


def paragraph(text: str, size: int, color: str = "1B1F24", bold: bool = False) -> str:
    weight = '<a:b/>' if bold else ""
    return (
        "<a:p>"
        "<a:pPr marL=\"0\" indent=\"0\"/>"
        "<a:r><a:rPr lang=\"en-US\" sz=\"%d\" dirty=\"0\">%s"
        "<a:solidFill><a:srgbClr val=\"%s\"/></a:solidFill>"
        "</a:rPr><a:t>%s</a:t></a:r>"
        "</a:p>"
    ) % (size, weight, color, esc(text))


def textbox(idx: int, x: int, y: int, w: int, h: int, lines: list[str], size: int = 2200,
            color: str = "1B1F24", bold_first: bool = False) -> str:
    body = "".join(
        paragraph(line, size, color, bold_first and i == 0)
        for i, line in enumerate(lines)
    )
    return f"""
      <p:sp>
        <p:nvSpPr><p:cNvPr id="{idx}" name="Text {idx}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
        <p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>{body}</p:txBody>
      </p:sp>
    """


def rect(idx: int, x: int, y: int, w: int, h: int, title: str, body: str = "",
         fill: str = "F6F8FA", line: str = "D0D7DE") -> str:
    lines = [title] + ([body] if body else [])
    sizes = [1900, 1350]
    body_xml = "".join(
        paragraph(line_text, sizes[min(i, 1)], "1B1F24", i == 0)
        for i, line_text in enumerate(lines)
    )
    return f"""
      <p:sp>
        <p:nvSpPr><p:cNvPr id="{idx}" name="Box {idx}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>
          <a:ln w="12700"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody><a:bodyPr wrap="square" lIns="160000" tIns="120000" rIns="160000" bIns="120000"/><a:lstStyle/>{body_xml}</p:txBody>
      </p:sp>
    """


def slide_xml(title: str, subtitle: str | None, bullets: list[str], boxes: list[str] | None = None) -> str:
    shapes = [
        textbox(2, 610000, 350000, 12_000_000, 700000, [title], 3300, "0B1320", True),
    ]
    if subtitle:
        shapes.append(textbox(3, 620000, 1_060_000, 11_900_000, 450000, [subtitle], 1500, "57606A"))
    if bullets:
        bullet_lines = [f"- {item}" for item in bullets]
        shapes.append(textbox(4, 900000, 1_700_000, 11_400_000, 4_900_000, bullet_lines, 1750, "24292F"))
    if boxes:
        shapes.extend(boxes)
    sp_tree = "\n".join(shapes)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{SLIDE_W}" cy="{SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="{SLIDE_W}" cy="{SLIDE_H}"/></a:xfrm></p:grpSpPr>
    {sp_tree}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""


def build_slides() -> list[str]:
    architecture_boxes = [
        rect(10, 650000, 1_650_000, 2_250_000, 900000, "Google Sheet", "config, ranges, group IDs", "EAF5FF"),
        rect(11, 3_200_000, 1_650_000, 2_250_000, 900000, "Apps Script Bot", "exports PDF, sends card", "FFF4E5"),
        rect(12, 5_750_000, 1_650_000, 2_250_000, 900000, "Azure Converter", "PDF -> PNG endpoint", "E6F4EA"),
        rect(13, 8_300_000, 1_650_000, 2_250_000, 900000, "SeaTalk API", "interactive message", "F3E8FF"),
        rect(14, 10_850_000, 1_650_000, 1_800_000, 900000, "Groups", "receive reports", "F6F8FA"),
        textbox(15, 2_930_000, 1_950_000, 300000, 300000, ["->"], 2600, "57606A", True),
        textbox(16, 5_480_000, 1_950_000, 300000, 300000, ["->"], 2600, "57606A", True),
        textbox(17, 8_030_000, 1_950_000, 300000, 300000, ["->"], 2600, "57606A", True),
        textbox(18, 10_580_000, 1_950_000, 300000, 300000, ["->"], 2600, "57606A", True),
        rect(19, 4_200_000, 3_350_000, 4_700_000, 900000, "Optional Render Callback Proxy", "validates SeaTalk signature, forwards events to Apps Script", "FFF0F0"),
    ]
    return [
        slide_xml(
            "Creating a SOC5 SeaTalk Bot + Bot Server",
            "Tutorial deck based on this repository: Apps Script bots, Azure converter service, and optional Render callback proxy.",
            ["Goal: create a bot that reads Google Sheets, renders a report image, and sends a SeaTalk card.",
             "Main example: SOC5 Intraday, with OTP, MDT, Workstation, and Control Tower as reusable variants.",
             "Keep secrets in Apps Script properties, Azure/Render environment variables, or ignored local files."],
        ),
        slide_xml("Project Architecture", "The bot logic and server logic are intentionally separated.", [], architecture_boxes),
        slide_xml(
            "Repository Map",
            None,
            ["bots/<bot-name>/apps-script/Code.gs: Google Apps Script workflow per bot.",
             "cmd/pdf-to-png-converter: Go HTTP service used by all bots.",
             "internal/converter: shared PDF-to-PNG conversion using pdftoppm and ImageMagick.",
             "cmd/seatalk-callback-proxy: optional Render service for signed SeaTalk callbacks.",
             "docs/: setup guides and bot-specific notes.",
             "BotLogs.gs: shared Apps Script helper for bot_logs sheet writes."],
        ),
        slide_xml(
            "What A Bot Does",
            None,
            ["Loads Script Properties and defaults.",
             "Opens the configured Google Spreadsheet.",
             "Reads group IDs from GOOGLE_GROUP_IDS_RANGE.",
             "Exports GOOGLE_CAPTURE_RANGE to PDF.",
             "Calls PDF_TO_PNG_SERVICE_URL with a bearer token.",
             "Builds a SeaTalk interactive card with title, description, image, and link.",
             "Sends to each group and writes send history to bot_logs."],
        ),
        slide_xml(
            "Step 1: Create The SeaTalk App",
            None,
            ["Create or reuse a SeaTalk app identity.",
             "Copy SEATALK_APP_ID and SEATALK_APP_SECRET.",
             "Add the bot to target SeaTalk group chats.",
             "Store group IDs in the sheet, usually bot_config!A2:A.",
             "Use a separate SeaTalk identity when the bot must appear as a different sender, such as MDT-SOC5."],
        ),
        slide_xml(
            "Step 2: Prepare The Google Sheet",
            None,
            ["Create the report tab and the bot_config tab.",
             "Choose the report capture range, for example intraday!C1:AD37.",
             "Choose description ranges, for example intraday!AE2 for FMS Update.",
             "Place target group IDs in GOOGLE_GROUP_IDS_RANGE.",
             "Keep adjacent group names if you want readable bot_logs output."],
        ),
        slide_xml(
            "Step 3: Create Apps Script Project",
            None,
            ["Create a new Apps Script project for the bot.",
             "Paste the bot Code.gs from bots/<bot-name>/apps-script/.",
             "Paste appsscript.json if the bot has one.",
             "Add BotLogs.gs when send logging is required.",
             "Run sendReportNow once to authorize Google and external requests."],
        ),
        slide_xml(
            "Script Properties To Set",
            None,
            ["SEATALK_APP_ID and SEATALK_APP_SECRET.",
             "GOOGLE_SPREADSHEET_ID, GOOGLE_CAPTURE_RANGE, GOOGLE_GROUP_IDS_RANGE.",
             "REPORT_TITLE_PREFIX, REPORT_SHEET_URL, and any description ranges.",
             "PDF_TO_PNG_SERVICE_URL and PDF_TO_PNG_SERVICE_TOKEN.",
             "REPORT_SEND_IMAGE=true, REPORT_INLINE_CARD_IMAGE=true, REPORT_REQUIRE_INLINE_CARD_IMAGE=true.",
             "BOT_PDF_DPI, BOT_IMAGE_RESIZE_WIDTH, and BOT_IMAGE_BORDER_PX when tuning image output."],
        ),
        slide_xml(
            "Step 4: Build The Bot Server",
            "In this project, the shared bot server is the Azure PDF-to-PNG converter.",
            ["Go entrypoint: cmd/pdf-to-png-converter/main.go.",
             "Endpoints: GET /healthz and POST /convert/pdf-to-png.",
             "Auth: Authorization: Bearer <PDF_TO_PNG_SERVICE_TOKEN>.",
             "Request: pdf_base64, dpi, resize_width, border_px.",
             "Response: image_base64 for the SeaTalk card image.",
             "Dockerfile builds the converter image for Azure Container Apps."],
        ),
        slide_xml(
            "Azure Deployment Flow",
            None,
            ["Create Azure Resource Group and Azure Container Registry.",
             "Add ACR_LOGIN_SERVER, ACR_USERNAME, and ACR_PASSWORD to GitHub Actions secrets.",
             "Run the Build Converter Image workflow.",
             "Create a Container Apps Environment and Container App.",
             "Set PORT, WORK_DIR, PDF_TO_PNG_SERVICE_TOKEN, and SEATALK_MAX_BASE64_BYTES.",
             "Enable HTTP ingress on target port 8080.",
             "Copy the Application URL and configure Apps Script PDF_TO_PNG_SERVICE_URL."],
        ),
        slide_xml(
            "Step 5: Install A Trigger",
            None,
            ["Intraday and OTP use hourly triggers near minute :00.",
             "Workstation and Control Tower send every three hours.",
             "MDT polls every five minutes and sends when the watch range changes.",
             "Apps Script time triggers are approximate, so titles can round timestamps for consistency.",
             "Run the bot's install trigger function once from the Apps Script editor."],
        ),
        slide_xml(
            "Optional Callback Proxy",
            "Use Render only when SeaTalk callback signature validation is required.",
            ["Apps Script can receive callbacks but cannot read inbound Signature headers.",
             "Render receives SeaTalk events, validates Signature, and forwards the JSON body to Apps Script.",
             "Render service uses Dockerfile.callback.",
             "Main settings: SEATALK_CALLBACK_PATH, SEATALK_SIGNING_SECRET, APPS_SCRIPT_WEB_APP_URL.",
             "Use the Render /bot-callback URL in the SeaTalk developer portal."],
        ),
        slide_xml(
            "Testing Checklist",
            None,
            ["Open Azure /healthz and expect {\"ok\":true}.",
             "Run testPdfToPngServiceHealth in Apps Script.",
             "Run sendReportNow and check SeaTalk output.",
             "Confirm image, title, description, and View Report Link button.",
             "Check bot_logs rows after successful sends.",
             "For callbacks, verify the Render /healthz endpoint and SeaTalk event_verification."],
        ),
        slide_xml(
            "Troubleshooting",
            None,
            ["Unauthorized from converter: PDF_TO_PNG_SERVICE_TOKEN does not match.",
             "SeaTalk code 7001: bot is not a member of that group chat.",
             "Message sends without image: check REPORT_* image flags and converter URL.",
             "Azure URL blank: confirm Container App ingress and target port 8080.",
             "Image too large: lower DPI or resize width, or inspect SEATALK_MAX_BASE64_BYTES.",
             "Callback verification fails: check Render logs and callback path."],
        ),
        slide_xml(
            "Create A New Bot From This Repo",
            None,
            ["Create a Google Sheet or new config range.",
             "Create bots/<bot-name>/apps-script/.",
             "Copy the closest existing Apps Script workflow and update defaults.",
             "Set Script Properties for credentials, ranges, report link, and schedule.",
             "Reuse the shared Azure converter URL and token.",
             "Run sendReportNow, install the trigger, then document the bot in docs/BOT_<NAME>.md."],
        ),
    ]


def write_static_package(z: zipfile.ZipFile, slide_count: int) -> None:
    slide_overrides = "\n".join(
        f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(1, slide_count + 1)
    )
    z.writestr("[Content_Types].xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  {slide_overrides}
</Types>""")
    z.writestr("_rels/.rels", rels([
        ("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument", "ppt/presentation.xml"),
    ]))
    slide_ids = "\n".join(
        f'<p:sldId id="{255 + i}" r:id="rId{i}"/>' for i in range(1, slide_count + 1)
    )
    z.writestr("ppt/presentation.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId{slide_count + 1}"/></p:sldMasterIdLst>
  <p:sldIdLst>{slide_ids}</p:sldIdLst>
  <p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>""")
    pres_rels = [
        (f"rId{i}", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", f"slides/slide{i}.xml")
        for i in range(1, slide_count + 1)
    ]
    pres_rels.append((f"rId{slide_count + 1}", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster", "slideMasters/slideMaster1.xml"))
    pres_rels.append((f"rId{slide_count + 2}", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme", "theme/theme1.xml"))
    z.writestr("ppt/_rels/presentation.xml.rels", rels(pres_rels))
    z.writestr("ppt/slideMasters/slideMaster1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="13333333" cy="7500000"/><a:chOff x="0" y="0"/><a:chExt cx="13333333" cy="7500000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/>
</p:sldMaster>""")
    z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([
        ("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout", "../slideLayouts/slideLayout1.xml"),
        ("rId2", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme", "../theme/theme1.xml"),
    ]))
    z.writestr("ppt/slideLayouts/slideLayout1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="13333333" cy="7500000"/><a:chOff x="0" y="0"/><a:chExt cx="13333333" cy="7500000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>""")
    z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([
        ("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster", "../slideMasters/slideMaster1.xml"),
    ]))
    z.writestr("ppt/theme/theme1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SOC5 Tutorial">
  <a:themeElements>
    <a:clrScheme name="SOC5"><a:dk1><a:srgbClr val="0B1320"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="24292F"/></a:dk2><a:lt2><a:srgbClr val="F6F8FA"/></a:lt2><a:accent1><a:srgbClr val="0969DA"/></a:accent1><a:accent2><a:srgbClr val="1A7F37"/></a:accent2><a:accent3><a:srgbClr val="9A6700"/></a:accent3><a:accent4><a:srgbClr val="8250DF"/></a:accent4><a:accent5><a:srgbClr val="CF222E"/></a:accent5><a:accent6><a:srgbClr val="57606A"/></a:accent6><a:hlink><a:srgbClr val="0969DA"/></a:hlink><a:folHlink><a:srgbClr val="8250DF"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="SOC5"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>""")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    slides = build_slides()
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as z:
        write_static_package(z, len(slides))
        for i, slide in enumerate(slides, start=1):
            z.writestr(f"ppt/slides/slide{i}.xml", slide)
            z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", rels([
                ("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout", "../slideLayouts/slideLayout1.xml"),
            ]))
    print(OUT)


if __name__ == "__main__":
    main()
