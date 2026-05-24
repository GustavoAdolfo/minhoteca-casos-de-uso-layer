resource "aws_lambda_layer_version" "casos_de_uso_layer" {
  layer_name               = "minhoteca-casos-de-uso-layer"
  compatible_runtimes      = [var.node_runtime]
  description              = "Lambda Layer com casos de uso do projeto Minhoteca"
  compatible_architectures = var.compatible_architectures
  filename                 = data.archive_file.casos_de_uso_layer_pack.output_path
  source_code_hash         = data.archive_file.casos_de_uso_layer_pack.output_base64sha256
  depends_on = [
    data.archive_file.casos_de_uso_layer_pack,
    data.external.casos_de_uso_layer_version,
  ]
  lifecycle {
    create_before_destroy = true
  }
}

data "external" "casos_de_uso_layer_version" {
  program = ["node", "${path.module}/../../../layer/nodejs/version.mjs"]
}

resource "null_resource" "casos_de_uso_layer_build" {
  triggers = {
    src_hash = sha256(join("", [for f in sort(fileset("${path.module}/../../../layer/nodejs/src", "**/*")) : filesha256("${path.module}/../../../layer/nodejs/src/${f}")]))
  }
  provisioner "local-exec" {
    command = <<EOF
      cd ${path.module}/../../../layer/nodejs
      npm ci
      npm run build
      rm -rf dist_layer
      mkdir -p dist_layer/nodejs
      cp package.json package-lock.json dist_layer/nodejs/
      cd dist_layer/nodejs
      npm ci --omit=dev
      mkdir -p node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer
      cp -r ../../dist node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer/
      cp ../../package.json node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer/
    EOF
  }
}

data "archive_file" "casos_de_uso_layer_pack" {
  depends_on  = [null_resource.casos_de_uso_layer_build]
  type        = "zip"
  source_dir  = "${path.module}/../../../layer/nodejs/dist_layer"
  output_path = "${path.module}/casos_de_uso_layer.zip"
}
