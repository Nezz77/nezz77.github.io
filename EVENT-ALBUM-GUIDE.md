# Adding an Event Album

This guide covers adding a folder-style album to the Event Photography gallery on
[`photographynh.html`](./photographynh.html). Albums are HTML cards; the existing
folder interaction and photo viewer are handled by
[`event-photo-gallery.js`](./event-photo-gallery.js) and styled in
[`style.css`](./style.css).

## What goes on the page

Each event card has two kinds of photo counts:

- **Preview photos** are local image files embedded in the folder. These are the
  photos visitors can open in the on-page photo viewer.
- **Album photos** are the total number of photos in the linked external album
  or albums. The page links to Facebook for the full album; it does not
  automatically download or display every photo in that album.

Keep those numbers separate and accurate. For multiple external albums, show
each album's count beside its link and the sum in the card footer.

## 1. Prepare the preview photos

1. Pick a representative set of preview photos from the event. The folder fan
   currently has explicit positions for up to **7 photos**. If the design needs
   more, add and test matching fan positions and stacking rules in `style.css`
   before adding extra photos.
2. Make an event-specific, lowercase, hyphenated folder under `events/`, for
   example `events/campus-concert/`. Keep these assets separate from other
   events.
3. Use descriptive filenames and WebP for new photographs. On macOS with
   `cwebp` installed, convert each selected photo like this:

   ```sh
   mkdir -p events/campus-concert
   cwebp -q 84 "/path/to/source/photo.jpg" -o events/campus-concert/concert-opening.webp
   ```

   Repeat for each preview image. Keep the originals in their source location;
   add only the optimized preview assets to the repository.
4. Confirm the conversion succeeded and that every output opens correctly.
   Avoid excessively large files; retain enough quality to look good in the
   folder and viewer.

## 2. Add the album card

In `photographynh.html`, find the `EVENT ALBUM CARDS` comment inside
`#gallery` → `.photography-grid`. Add the new card near the top of that list so
the newest event appears first.

Copy an existing card as a starting point and update **all** of its details:

- Use the next available descriptive album comment and a unique
  `event-folder-photos-N` ID. Check the entire HTML file for duplicates.
- Keep the outer `gallery-item` set to `data-category="events"`.
- Set the folder name to the requested organization or event brand. The card
  tag can identify the photographer/organization; the title should identify
  the event.
- Give each image a useful `alt` and its button an accessible `aria-label`.
  Point each `src` to a file in this album's own `events/<slug>/` folder.
- Make the first image the main/cover preview with `class="preview-main"`.
  Use `class="preview-more"` on the fifth image when there is one; other images
  follow the existing card convention.
- Set the closed-folder count to the number of embedded previews, such as
  `05 preview photos · Click to open`.
- Keep the folder button's `aria-controls` equal to the folder photos container
  ID and use `aria-expanded="false"` initially.
- Link to the actual external album post with `target="_blank"` and
  `rel="noopener"`.
- In the footer, show the full external album total, not the preview count.

The folder viewer reads photos directly from the `.album-folder-photo img`
elements. Preserve that markup and the containing `.event-album-card`, including
its `.event-album-title`; the viewer uses the title for its heading.

### Card skeleton

Use this as a structure reference; replace every `REPLACE` value and repeat the
photo button for each preview (up to 7 without changing the fan layout):

```html
<!-- Album 13: REPLACE WITH EVENT NAME -->
<div class="col-12 col-lg-6 gallery-item" data-category="events">
    <div class="event-album-card">
        <div class="album-preview-grid album-folder">
            <div class="album-folder-back" aria-hidden="true"></div>
            <div class="album-folder-photos" id="event-folder-photos-13">
                <button type="button" class="album-folder-photo" tabindex="-1"
                    aria-hidden="true" aria-label="Open REPLACE photo 1">
                    <img src="events/REPLACE/photo-1.webp" alt="REPLACE"
                        class="preview-main" loading="lazy">
                </button>
                <button type="button" class="album-folder-photo" tabindex="-1"
                    aria-hidden="true" aria-label="Open REPLACE photo 2">
                    <img src="events/REPLACE/photo-2.webp" alt="REPLACE"
                        loading="lazy">
                </button>
                <!-- Add one button per preview photo. -->
            </div>
            <button type="button" class="album-folder-front" aria-expanded="false"
                aria-controls="event-folder-photos-13"
                aria-label="Expand REPLACE photos">
                <span class="album-folder-name">REPLACE BRAND</span>
                <span class="album-folder-count">02 preview photos · Click to open</span>
            </button>
        </div>
        <div class="event-album-body">
            <div class="event-album-tag">
                <i class="bi bi-camera-fill"></i> REPLACE BRAND
            </div>
            <h5 class="event-album-title">REPLACE EVENT TITLE</h5>
            <p class="event-album-desc">REPLACE WITH A SHORT, ACCURATE DESCRIPTION.</p>
            <div class="event-album-footer">
                <div class="event-album-links">
                    <a href="https://www.facebook.com/REPLACE"
                        target="_blank" rel="noopener" class="btn-view-album">
                        <i class="bi bi-facebook"></i> View Album
                    </a>
                </div>
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.35);">
                    174 photos · 1 album
                </span>
            </div>
        </div>
    </div>
</div>
```

### Events with multiple external albums

Add a link for each album and show its count in the link label, for example
`Album I · 120 photos` and `Album II · 85 photos`. Show the combined count in
the footer (`205 photos · 2 albums`). Keep the local preview set representative
of the event; its size does not determine the external totals.

## 3. Check behavior and assets

Before committing:

1. Check for duplicate HTML IDs, especially the new
   `event-folder-photos-N` ID.
2. Verify each local `events/...` image path exists, uses the correct
   capitalization, and belongs to this event.
3. Confirm preview and full-album counts are correct, including sums for
   multi-album cards.
4. Check the card in a browser at desktop and mobile widths:
   - Hover (or focus) previews lift without one photo unexpectedly staying in
     front.
   - Clicking the folder fans out the previews; hovering/focusing an individual
     photo brings that photo forward.
   - Clicking a photo opens the viewer, and its title, navigation, thumbnails,
     and close behavior work.
   - Each external link opens the intended album.
5. Run the lightweight repository checks:

   ```sh
   git diff --check
   node --check event-photo-gallery.js
   ```

   `node --check` is most relevant if you changed gallery JavaScript. To check
   for duplicate IDs and missing local image files in the photography page, run:

   ```sh
   python3 - <<'PY'
   from collections import Counter
   from html.parser import HTMLParser
   from pathlib import Path

   class GalleryAudit(HTMLParser):
       def __init__(self):
           super().__init__()
           self.ids = []
           self.images = []

       def handle_starttag(self, tag, attrs):
           attrs = dict(attrs)
           if "id" in attrs:
               self.ids.append(attrs["id"])
           if tag == "img" and "src" in attrs:
               self.images.append(attrs["src"])

   audit = GalleryAudit()
   audit.feed(Path("photographynh.html").read_text())

   duplicates = [value for value, count in Counter(audit.ids).items() if count > 1]
   missing = [
       src for src in audit.images
       if not src.startswith(("http://", "https://", "data:")) and not Path(src).is_file()
   ]
   if duplicates or missing:
       raise SystemExit(f"Duplicate IDs: {duplicates}; missing images: {missing}")
   print(f"Checked {len(audit.ids)} IDs and {len(audit.images)} image references.")
   PY
   ```

   This checks markup references, not photo counts or visual behavior; verify
   those separately and inspect the page in a browser.

New same-origin images are dynamically cached by `service-worker.js` after
they're fetched, so a normal album addition does not require editing its
precache list. If you change gallery JavaScript or CSS behavior, preserve the
existing cache-busting query convention on the corresponding script or
stylesheet link in `photographynh.html`, and change its `v=` value so browsers
fetch the updated file.

## 4. Commit and publish

Review the staged paths and make sure only the intended page and new preview
assets are included:

```sh
git status --short
git diff --check
git add photographynh.html events/<event-slug>
git commit -m "Add <event name> photo album"
git push origin main
```

Replace `<event-slug>` and `<event name>` with the album's actual names. After
the push, confirm the worktree is clean and the commit reached the intended
branch.
