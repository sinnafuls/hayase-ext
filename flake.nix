{
  description = "hayase-ext dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in {
      devShells = forAll (pkgs: {
        # Matches CI (.github/workflows/build.yml uses node-version 22).
        default = pkgs.mkShell { packages = [ pkgs.nodejs_22 ]; };
      });
    };
}
