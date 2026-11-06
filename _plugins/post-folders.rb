# frozen_string_literal: true

# Post folders: a post can live in its own folder under _posts/, next to the files it uses.
#
#   _posts/weight-games/2026-11-03-weight-games.md   ->  /blog/2026/weight-games/
#   _posts/weight-games/weight-viz.js                ->  /blog/2026/weight-games/weight-viz.js
#   _posts/weight-games/img/frame.png                ->  /blog/2026/weight-games/img/frame.png
#
# So the post can load its files by relative path (<script src="weight-viz.js">).
# Posts that sit directly in _posts/ are untouched.
#
# Not copied:
#   - preview.html (a standalone development page), plus anything listed in _config.yml under
#       post_folders:
#         exclude: ["notes.txt", "drafts/*"]
#   - Markdown files (.md, .markdown)
#   - files or folders whose name starts with "_" or "."
#
# The generator runs last (priority :lowest), after jekyll-terser has collected the site's .js
# files, so a post folder's JavaScript is copied as written rather than minified or relocated.
#
# Adapted from jekyll-postfiles by Nicolas Hoizey (MIT), with exclusions added.

module Jekyll
  module PostFolders
    DEFAULT_EXCLUDE = ["preview.html"].freeze
    SKIP_EXTENSIONS = [".md", ".markdown"].freeze

    # A static file whose output location is the post's folder rather than its source path.
    class PostFolderFile < StaticFile
      def initialize(site, source_dir, name, dest_dir, url_dir)
        super(site, site.source, source_dir, name)
        @dest_dir = dest_dir
        @url_dir = url_dir
      end

      def destination(_dest)
        File.join(@dest_dir, @name)
      end

      def url
        File.join(@url_dir, @name)
      end
    end

    class Generator < Jekyll::Generator
      safe true
      priority :lowest

      def generate(site)
        posts_root = File.expand_path(File.join(site.source, "_posts"))
        excludes = DEFAULT_EXCLUDE + Array((site.config["post_folders"] || {})["exclude"])
        seen = {}

        site.posts.docs.each do |doc|
          folder = File.expand_path(File.dirname(doc.path))
          next if folder == posts_root

          if seen[folder]
            Jekyll.logger.warn "Post folders:", "#{folder} holds more than one post; its files are copied next to the first only."
            next
          end
          seen[folder] = true

          dest_dir = File.dirname(doc.destination(site.dest))   # e.g. _site/blog/2026/weight-games
          url_dir = File.dirname(doc.url.end_with?("/") ? File.join(doc.url, "index.html") : doc.url)

          Dir.glob("**/*", base: folder).sort.each do |rel|
            full = File.join(folder, rel)
            next if File.directory?(full)
            next if rel.split("/").any? { |part| part.start_with?("_", ".") }
            next if SKIP_EXTENSIONS.include?(File.extname(rel).downcase)
            next if excludes.any? { |pat| File.fnmatch?(pat, rel) || File.fnmatch?(pat, File.basename(rel)) }

            sub = File.dirname(rel) == "." ? "" : File.dirname(rel)
            source_dir = File.dirname(full).delete_prefix(File.expand_path(site.source) + "/")
            site.static_files << PostFolderFile.new(site, source_dir, File.basename(rel),
                                                    File.join(dest_dir, sub), File.join(url_dir, sub))
          end
        end
      end
    end
  end
end
