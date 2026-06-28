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

  constructor(private _repository: RepositoryInterface) {
    this._tabelaEditoras = process.env.TABELA_EDITORAS ?? 'Editoras';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso CriarEditoraUseCase',
      { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
        { body }
      );

      const entity = EditoraAdapter.fromCreateDTO(body);
      this.logService.info(
        'Dados convertidos para entidade',
        { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );

      await this._repository.saveData(this._tabelaEditoras, JSON.parse(entity.toJSONString()));
      this.logService.info(
        'Editora gravada com sucesso',
        { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );
      const editoraDTO: EditoraDTO = EditoraAdapter.toDTO(entity);

      this.logService.info(
        'Dados convertidos para DTO de retorno',
        { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
        { editoraDTO }
      );
      return createResult([editoraDTO], 201, 'Editora criada com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar editora:',
        { label: 'CriarEditoraUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new EditoraInvalidaError('Falha ao criar editora.');
    }
  }
}
