"""framework/tools/health.py: the images of a web site (`public/`) and the app icons of Next.js (`src/app/`) belong in
git; the improve review called the 17 PNG files of tumach-dance a false alarm twice (2026-10-30)."""
import health


def test_web_images_and_app_icons_are_allowed():
    files = [("public/guide/en/login-code.png", 22_000), ("public/icons/icon-192.png", 2_000),
             ("src/app/icon.png", 2_000), ("docs/design/look.png", 9_000)]
    assert health.bad_files(files) == []


def test_other_pngs_logs_and_big_files_still_count():
    files = [("out/screenshot.png", 9_000), ("src/lib/shot.png", 9_000), ("server.log", 10),
             ("public/video.mp4", 2 << 20)]
    assert [p for p, _ in health.bad_files(files)] == ["out/screenshot.png", "src/lib/shot.png", "server.log",
                                                         "public/video.mp4"]
