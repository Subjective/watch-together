import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Star,
  Download,
  Users,
  Play,
  FolderSyncIcon as Sync,
  Shield,
  Zap,
} from "lucide-react";
import { SiGithub, SiDiscord } from "react-icons/si";
import Image from "next/image";
import Link from "next/link";
import { ExtensionMockup } from "@/components/extension-mockup";
import { Logo } from "@repo/logo";

interface GitHubRepo {
  stargazers_count: number;
}

async function getGitHubStars(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Subjective/watch-together",
      {
        next: { revalidate: 3600 }, // Revalidate every hour
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "watch-together-website",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const repo: GitHubRepo = await response.json();
    return repo.stargazers_count;
  } catch (error) {
    console.error("Failed to fetch GitHub stars:", error);
    return 0; // Fallback to 0 if API fails
  }
}

export default async function WatchTogetherLanding() {
  const starCount = await getGitHubStars();

  // Format star count for display
  const formatStars = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Logo size={32} />
              <span className="text-xl font-bold text-gray-900">
                Watch Together
              </span>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
              <Link
                href="#features"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Features
              </Link>
              <Link
                href="#demo"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Demo
              </Link>
              <Link
                href="#faq"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                FAQ
              </Link>
              <Link
                href="https://github.com/Subjective/watch-together"
                className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <SiGithub className="h-4 w-4" />
                <span>GitHub</span>
                <Badge variant="secondary" className="ml-1">
                  <Star className="h-3 w-3 mr-1" />
                  {starCount > 0 ? formatStars(starCount) : "—"}
                </Badge>
              </Link>
              <Link
                href="https://buymeacoffee.com/watchtogether"
                className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-red-500 transition-colors"
                title="Support the project"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                  🎉 Completely free & open source
                </Badge>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Watch videos{" "}
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    together
                  </span>{" "}
                  with friends
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Synchronize video playback in real-time across multiple
                  browsers with smart control modes and instant setup. Watch
                  your favorite shows, movies, and videos with friends anywhere
                  in the world.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="https://github.com/Subjective/watch-together/releases"
                  className="inline-flex"
                >
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 w-full"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download Extension
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 py-3 bg-transparent"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    View Demo
                  </Button>
                </Link>
              </div>

              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>Growing community</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>Open source project</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl shadow-2xl p-16 flex items-center justify-center">
                <div className="text-center">
                  <Image
                    src="/window.svg"
                    alt="Browser window representing video synchronization"
                    width={200}
                    height={200}
                    className="mx-auto mb-6 opacity-60"
                  />
                  <p className="text-lg text-gray-600 font-medium">
                    Synchronized video watching
                    <br />
                    across multiple browsers
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">
                    3 friends watching
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need for synchronized watching
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features that make watching videos together seamless and
              fun
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Sync className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Real-Time Sync</CardTitle>
                <CardDescription>
                  Automatic real-time synchronization ensures everyone watches
                  the same thing, at exactly the same time
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Smart Control Modes</CardTitle>
                <CardDescription>
                  Choose between host-only control for organized viewing or
                  free-for-all mode for collaborative watching
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Privacy First</CardTitle>
                <CardDescription>
                  Your data stays private. No account required, no personal
                  information stored, and no ads ever
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle>Peer-to-Peer Technology</CardTitle>
                <CardDescription>
                  Direct browser-to-browser communication using WebRTC for
                  minimal latency and optimized performance
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Play className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Universal Compatibility</CardTitle>
                <CardDescription>
                  Works with nearly all video sites including Netflix, YouTube,
                  Disney+, Hulu, Crunchyroll, and more
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Download className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Easy Setup</CardTitle>
                <CardDescription>
                  Install in seconds, share a link, and start watching together
                  immediately with automatic host following
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section
        id="demo"
        className="py-20 bg-gradient-to-r from-purple-50 to-blue-50"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              See it in action
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Try our interactive demo to see how easy it is to start a watch
              party
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="w-full overflow-hidden">
              <ExtensionMockup />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about Watch Together
            </p>
          </div>

          <div className="max-w-3xl mx-auto mb-8">
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How does Watch Together work?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Watch Together uses WebRTC peer-to-peer technology to create
                  synchronized viewing sessions with sub-second latency. When
                  one person plays, pauses, or seeks, the action is instantly
                  synchronized across all participants. Simply install the
                  extension, visit a supported video site, and share the
                  generated link with with friends.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Which platforms are supported?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Watch Together works with any streaming site that uses HTML5
                  video players. This includes YouTube, Netflix, Twitch,
                  Disney+, Hulu, Amazon Prime Video, and virtually any modern
                  video platform. Our universal approach means compatibility
                  without needing platform-specific updates, though custom
                  adapters can be added for enhanced platform support.
                  Contributions are welcome!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Do I need to create an account?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  No account required! Watch Together works completely
                  anonymously. Just install the extension and start watching. We
                  don&apos;t collect personal information or require sign-ups.
                  Your privacy is our priority.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How many people can watch together?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Watch Together supports multiple participants per room with no
                  hard limit. Performance depends on network conditions and
                  device capabilities. For optimal experience with real-time
                  sync, we recommend groups of 2-10 people, though larger groups
                  are possible.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Is Watch Together free?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Yes! Watch Together is completely free and open source. We
                  believe watching together should be accessible to everyone.
                  The extension has no ads, no premium features, no hidden
                  costs, and the source code is publicly available on GitHub.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How do control modes work?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Watch Together offers Host-only mode (only the room creator
                  controls playback) and Free-for-all mode (anyone can control).
                  Hosts can toggle between modes anytime. Additionally,
                  participants can enable &quot;Auto-follow host&quot; to
                  automatically follow and sync with the host when they switch
                  videos.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What if the video goes out of sync?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Watch Together keeps playback, pausing, and seeking in sync
                  for all participants. If you experience any sync issues, try
                  refreshing the page and the extension will automatically
                  attempt to resynchronize. For the best experience, ensure all
                  participants have a stable internet connection.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to start watching together?
            </h2>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Join thousands of users who are already enjoying synchronized
              video watching with friends
            </p>
            <Link href="https://github.com/Subjective/watch-together/releases">
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 text-lg"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Extension
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Logo size={32} />
                <span className="text-xl font-bold">Watch Together</span>
              </div>
              <p className="text-gray-400">Sync videos with friends.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="#features" className="hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#demo" className="hover:text-white">
                    Demo
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Supported Sites
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="#faq" className="hover:text-white">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link
                    href="https://github.com/Subjective/watch-together"
                    className="hover:text-white flex items-center space-x-1"
                  >
                    <SiGithub className="h-4 w-4" />
                    <span>GitHub</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white flex items-center space-x-1"
                  >
                    <SiDiscord className="h-4 w-4" />
                    <span>Discord</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} Watch Together. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
