import {
  Editora,
  Livro,
  PageDataType,
  EditoraAdapter,
  LivroAdapter,
  UseCaseInterface,
  EditoraInterface,
  LivroInterface,
  LogService,
  LivroDTO,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterEditoraUseCase implements UseCaseInterface {
  private _tabelaEditoras: string;
  private _tabelaLivros: string;
  private logService = new LogService('ObterEditoraUseCase');

  constructor(
    private _repository: RepositoryInterface,
    private idExecucao?: string
  ) {
    this._tabelaEditoras = process.env.TABELA_EDITORAS ?? 'Editoras';
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterEditoraUseCase',
      {
        label: 'ObterEditoraUseCase',
        logId: this.idExecucao,
      },
      { data }
    );
    try {
      const editoraId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (editoraId) {
        const result: ResultType = await this._repository.findByMinhotecaId(
          this._tabelaEditoras,
          editoraId
        );
        this.logService.info(
          `Editora encontrada = ${!!result?.data}`,
          {
            editoraId,
            label: 'ObterEditoraUseCase',
            logId: this.idExecucao,
          },
          { result }
        );
        if (result?.data) {
          this.logService.info(
            'Criando entidade Editora a partir dos dados recuperados',
            { label: 'ObterEditoraUseCase', editoraId, logId: this.idExecucao },
            { result }
          );
          const editoraEntity = Editora.create(
            result.data as EditoraInterface,
            Object.getOwnPropertyDescriptor(result.data, 'id')?.value
          );
          this.logService.info(
            'Convertendo Editora para DTO',
            { label: 'ObterEditoraUseCase', editoraId, logId: this.idExecucao },
            { result }
          );
          const editora = EditoraAdapter.toDTO(editoraEntity);

          this.logService.info('Buscando dados de livros associados à editora', {
            label: 'ObterEditoraUseCase',
            editoraId,
            logId: this.idExecucao,
          });

          const livros = await this._repository.getAll(this._tabelaLivros, {
            filterKey: 'editoraId',
            filterValue: editoraId,
            limit: 1000,
          });
          if (livros?.data?.length > 0) {
            const livroEntities = (livros.data as LivroInterface[]).map((livroData) =>
              Livro.create(livroData, Object.getOwnPropertyDescriptor(livroData, 'id')?.value)
            );
            const livrosDTO = LivroAdapter.toDTOList(livroEntities);
            editora.livros = livrosDTO.map((livro) => {
              return {
                id: livro.id,
                titulo: livro.titulo,
                subtitulo: livro.subtitulo,
                imagemCapaUrl: livro.imagemCapaUrl,
              } as LivroDTO;
            });
          }

          return createResult([editora], 200, 'Editora obtida com sucesso.');
        }
        this.logService.warn('Editora não encontrada.', {
          editoraId,
          label: 'ObterEditoraUseCase',
          logId: this.idExecucao,
        });
        return createResult([], 404, 'Editora não encontrada.');
      }

      throw new EditoraInvalidaError('ID da editora não informado.');
    } catch (error) {
      this.logService.error(
        'Erro ao obter editora:',
        { label: 'ObterEditoraUseCase', logId: this.idExecucao },
        error as Error
      );
      throw new EditoraInvalidaError('Falha ao obter editora.');
    }
  }
}
