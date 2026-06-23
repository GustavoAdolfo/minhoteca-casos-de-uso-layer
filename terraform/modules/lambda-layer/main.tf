resource "aws_lambda_layer_version" "casosDeUsoLayer" {
  layer_name               = "minhoteca-casos-de-uso-layer"
  compatible_runtimes      = [var.node_runtime]
  description              = "Lambda Layer Core do projeto Minhoteca"
  compatible_architectures = var.compatible_architectures
  filename                 = data.archive_file.casos_de_uso_layer_pack.output_path
  source_code_hash         = data.archive_file.casos_de_uso_layer_pack.output_base64sha256
  depends_on = [
    data.external.casos_de_uso_layer_version,
  ]
  lifecycle {
    create_before_destroy = true
  }
}

data "external" "casos_de_uso_layer_version" {
  program = ["node", "${path.module}/../../../version.mjs"]
}


resource "null_resource" "casos_de_uso_layer_build" {
  triggers = {
    src_hash   = sha256(join("", [for f in sort(fileset("${path.module}/../../../layer/nodejs/src", "**/*")) : filesha256("${path.module}/../../../layer/nodejs/src/${f}")]))
    pkg_hash   = filesha256("${path.module}/../../../layer/nodejs/package.json")
    always_run = timestamp() # Força o script a rodar sempre, essencial para o runner do GitHub Actions
  }
  provisioner "local-exec" {
    working_dir = "${path.module}/../../.."
    interpreter = ["bash", "-e", "-c"] # Garante que o script pare imediatamente se ocorrer algum erro
    command     = <<EOF
      npm ci
      npm run build
      rm -rf dist_layer
      mkdir -p dist_layer/nodejs
      cp layer/nodejs/package.json layer/nodejs/package-lock.json dist_layer/nodejs/
      cd dist_layer/nodejs
      npm ci --omit=dev
      mkdir -p node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer
      cp -r ../../layer/nodejs/dist node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer/
      cp ../../package.json node_modules/@gustavoadolfo/minhoteca-casos-de-uso-layer/
    EOF
  }
}

data "archive_file" "casos_de_uso_layer_pack" {
  depends_on  = [null_resource.casos_de_uso_layer_build]
  type        = "zip"
  source_dir  = "${path.module}/../../../dist_layer"
  output_path = "${path.module}/casos_de_uso_layer.zip"
}
