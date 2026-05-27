# Bode Homebrew formula (#19).
#
# Lives at this path inside the repo as a template/reference. The actual tap
# lives at KakunynQA/homebrew-tap and is auto-bumped by the release workflow.
#
# Local install (without the tap):
#   brew install --formula ./packaging/homebrew/bode.rb
#
# Tap install (once published):
#   brew tap kakunynqa/tap
#   brew install bode

class Bode < Formula
  desc "Local CLI that orchestrates AI coding work through configurable phases"
  homepage "https://github.com/KakunynQA/bode"
  license "MIT"

  # Updated on each release by the CI workflow.
  version "0.27.0"

  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/KakunynQA/bode/releases/download/v#{version}/bode-darwin-arm64"
    sha256 "REPLACE_ME_ON_RELEASE"
  elsif OS.mac?
    url "https://github.com/KakunynQA/bode/releases/download/v#{version}/bode-darwin-x64"
    sha256 "REPLACE_ME_ON_RELEASE"
  elsif OS.linux? && Hardware::CPU.arm?
    url "https://github.com/KakunynQA/bode/releases/download/v#{version}/bode-linux-arm64"
    sha256 "REPLACE_ME_ON_RELEASE"
  else
    url "https://github.com/KakunynQA/bode/releases/download/v#{version}/bode-linux-x64"
    sha256 "REPLACE_ME_ON_RELEASE"
  end

  def install
    bin.install Dir["bode-*"].first => "bode"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bode --version")
  end
end
