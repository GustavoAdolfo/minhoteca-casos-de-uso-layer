import {
  EditoraDTO,
  EditoraAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class CriarEditoraUseCase implements UseCaseInterface {
  private _tabelaEditoras: string;
  private logService = new LogService('CriarEditoraUseCase');

  constructor(
    private _repository: RepositoryInterface,
    private idExecucao?: string
  ) {
    this._tabelaEditoras = process.env.TABELA_EDITORAS ?? 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso CriarEditoraUseCase',
      { label: 'CriarEditoraUseCase', logId: this.idExecucao },
      { data }
    );
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'CriarEditoraUseCase', logId: this.idExecucao },
        { body }
      );

      const entity = EditoraAdapter.fromCreateDTO(body);
      this.logService.info(
        'Dados convertidos para entidade',
        { label: 'CriarEditoraUseCase', logId: this.idExecucao },
        { entity }
      );

      await this._repository.saveData(this._tabelaEditoras, JSON.parse(entity.toJSONString()));
      this.logService.info(
        'Editora gravada com sucesso',
        { label: 'CriarEditoraUseCase', logId: this.idExecucao },
        { entity }
      );
      const editoraDTO: EditoraDTO = EditoraAdapter.toDTO(entity);

      this.logService.info(
        'Dados convertidos para DTO de retorno',
        { label: 'CriarEditoraUseCase', logId: this.idExecucao },
        { editoraDTO }
      );
      return createResult([editoraDTO], 201, 'Editora criada com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar editora:',
        { label: 'CriarEditoraUseCase', logId: this.idExecucao },
        error as Error,
        { data }
      );
      throw new EditoraInvalidaError('Falha ao criar editora.');
    }
  }
}
